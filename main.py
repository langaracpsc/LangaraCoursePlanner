from flask import Flask, abort, redirect, render_template, jsonify, request, send_from_directory
import requests
import sys

ALL_COURSES:list[str] = []
SUBJECT_CODES:list[str] = []
api_url = f"https://coursesapi.langaracs.ca/index/courses"
response = requests.get(api_url)
if response.status_code == 200:
    data = response.json()
    for course in data['courses']:
        ALL_COURSES.append(f'{course["subject"]} {course["course_code"]}')
        
        if course["subject"] not in SUBJECT_CODES:
            SUBJECT_CODES.append(course["subject"])

app = Flask(
    __name__, 
    static_folder='static', 
    template_folder='templates'
)

class APIProblem(Exception):

    def __init__(self, message, status_code, payload=None):
        Exception.__init__(self)
        self.message = message
        self.status_code = status_code
        self.payload = payload


@app.errorhandler(APIProblem)
def handle_bad_request(error: APIProblem):
    response = jsonify(error.payload)
    response.status_code = error.status_code
    return render_template('error.html', status_code=error.status_code, error_message=error.message), error.status_code

def api_request(api_url) -> requests.Response:
    try:
        response = requests.get(api_url)
        if response.status_code != 200:
            raise APIProblem("Failed to fetch data", 500, response)
        
        return response
    
    except Exception as e:
        raise APIProblem("Failed to fetch data", 500, str(e))
        

    

@app.route('/')
def index():
    return send_from_directory("static", "index.html")

@app.route('/about')
def about():
    return send_from_directory("static", "about.html")

# serve css / jss / assets for index.html
@app.route('/<path:filename>')
def index_files(filename:str):
    
    if filename == "about.html":
        return redirect("/about", 301)
        
    return send_from_directory("static", filename)

# WHY IS THIS NECCESSARY??? /libraries works??? flask returns a 422 without this
@app.route('/js/<path:path>')
def send_js(path):
    return send_from_directory('static/js', path)

@app.route('/assets/<path:path>')
def send_assets(path):
    return send_from_directory('static/assets', path)

# chatgpt told me to put these here
# they're responsible for making the attribute table pretty
@app.template_filter()
def attr_color(value):
    return "green" if value else ""

@app.template_filter()
def format_attribute(value):
    if value == "yes":
        return "yes"
    if value == "no":
        return "no"
    return value

# Add links to prerequisites text
@app.template_filter()
def fmt_text_with_links(text:str) -> str:
    SUS_SEPARATOR = "🏺"
    
    assert SUS_SEPARATOR not in text
    
    text_split = text
    replacement_values = " .,;/()[]"
    
    for char in replacement_values:
        text_split = text_split.replace(char, f'🏺{char}🏺')
        
    text_split = text_split.split(SUS_SEPARATOR)
    
    ARBITRARY_BIG_NUMBER = 1000000
    
    current_subject = ""
    distance_since_subject_update = ARBITRARY_BIG_NUMBER
   
        
    for i, word in enumerate(text_split):
        if word in SUBJECT_CODES:
            current_subject = word
            distance_since_subject_update = -1
        
        distance_since_subject_update += 1
                
        if len(word) == 4 and word.isdigit():
            if f"{current_subject} {word}" in ALL_COURSES:
                
                if (distance_since_subject_update < ARBITRARY_BIG_NUMBER):
                    text_split[i-distance_since_subject_update] = None
                    text_split[i] = f"<a href='/course/{current_subject}/{word}'>{current_subject} {word}</a>"
                    distance_since_subject_update = ARBITRARY_BIG_NUMBER
                else:
                    text_split[i] = f"<a href='/course/{current_subject}/{word}'>{word}</a>"
    
    while None in text_split:
        text_split.remove(None)
        
    return "".join(text_split)


    
@app.route('/course')
def all_courses():
    api_url = f"https://coursesapi.langaracs.ca/index/courses"
    response = api_request(api_url)
    
    data = response.json()
    
    subjects = {}
    active_c = 0
    active_s = 0
    
    for course in data['courses']:
        if course['subject'] not in subjects:
            subjects[course['subject']] = ([], [])
       
        if course["active"]:
            subjects[course['subject']][0].append(course)
            active_c+=1
        else:
            subjects[course['subject']][1].append(course)    
    
    for s in subjects:
        if len(subjects[s][0]) > 0:
            active_s+=1

    return render_template('all_courses.html', 
                           count_s=len(subjects), 
                           count_s_active=active_s,
                           count_s_inactive=len(subjects)-active_s,
                           count_c=len(data['courses']), 
                           count_c_active=active_c,
                           count_c_inactive=len(data['courses'])-active_c,
                           subject="All Courses", 
                           subjects=subjects)
        

# route for getting all courses for a subject
@app.route('/course/<department>', strict_slashes=False)
def subject(department:str):
    api_url = f"https://coursesapi.langaracs.ca/index/courses"
    response = api_request(api_url)
    
    data = response.json()
        
    subject_courses:list[dict] = []
    
    department=department.upper()
    for c in data["courses"]:
        if c['subject'] == department:
            subject_courses.append(c)
    
    if len(subject_courses) == 0:
        raise APIProblem("Subject not found", 404)
    
    active_courses = []
    inactive_courses = []
    
    for c in subject_courses:
        if c["active"]:
            active_courses.append(c)
        else:
            inactive_courses.append(c)
    
    return render_template('subject.html', subject=department, active_courses=active_courses, inactive_courses=inactive_courses)
        

# route for getting specific course
@app.route('/course/<department>/<course_number>')
def course(department, course_number):
    api_url = f"https://coursesapi.langaracs.ca/course/{department}/{course_number}"
    response = api_request(api_url)
    
    data = response.json()
    
    # must be parsed here, its not possible to extract in the jinja template

    current_term = requests.get("https://coursesapi.langaracs.ca/index/latest_semester")
    current_term = current_term.json()
        
    # for c in data["offerings"]:
    #     c["year"] = int(c['id'].split("-")[3])
    #     c["term"] = int(c['id'].split("-")[4])
    
    
    offered_in_current_semester = [s for s in data["offerings"] if s['year'] == current_term['year'] and s['term'] == current_term['term']]
    old_offerings = [s for s in data["offerings"] if s['year'] != current_term['year'] or s['term'] != current_term['term']]
    old_offerings.reverse()
        
    current_transfers = [t for t in data["transfers"] if t["effective_end"] == None]
    inactive_transfers = [t for t in data["transfers"] if t["effective_end"] != None]
    
    if data["title"] == "" or data["title"] == None:
        data["title"] = data["abbreviated_title"]
        
    return render_template('course.html', course_info=data, transfers=current_transfers, inactive_transfers=inactive_transfers, offerings=old_offerings, current_offerings=offered_in_current_semester, current_term=current_term)


# route for getting specific course
@app.route('/transfer/<institution>')
def transfer(institution):
    institution = institution.upper()
    api_url = f"https://coursesapi.langaracs.ca/transfers/{institution}"
    response = api_request(api_url)
    
    data = response.json()
    
    # must be parsed here, its not possible to extract in the jinja template

    active_transfers = []
    inactive_transfers = []
        
    for t in data:
        if t["effective_end"] == None:
            active_transfers.append(t)
        else:
            inactive_transfers.append(t)
        
    return render_template('transfer.html', institution=institution, active_transfers=active_transfers, inactive_transfers=inactive_transfers)
            
@app.route('/utilities/campus')
def campus_population():
    return render_template('utilities/index.html')

if __name__ == '__main__':
    print(f"Starting frontend with {len(ALL_COURSES)} cached courses.")

    if "-dev" in sys.argv:
        app.run(debug=True)
        
    else:
        # app.run()
        from waitress import serve
        serve(app, host="0.0.0.0", port=5000, threads=20)
        