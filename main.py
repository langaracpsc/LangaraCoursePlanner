from flask import Flask, render_template, jsonify, request, send_from_directory
import requests
import sys

app = Flask(
    __name__, 
    static_folder='static', 
    template_folder='templates'
)

@app.route('/')
def index():
    return send_from_directory("static", "index.html")

@app.route('/about')
def about():
    return send_from_directory("static", "about.html")

# serve css / jss / assets for index.html
@app.route('/<path:filename>')
def index_files(filename:str):
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

@app.route('/course')
def all_courses():
    api_url = f"https://coursesapi.langaracs.ca/index/courses"
    response = requests.get(api_url)
    if response.status_code != 200:
        return jsonify({'error': 'Failed to fetch data'}), response.status_code
    
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
    response = requests.get(api_url)
    if response.status_code != 200:
        return jsonify({'error': 'Failed to fetch data'}), response.status_code
    
    data = response.json()
        
    subject_courses:list[dict] = []
    
    department=department.upper()
    for c in data["courses"]:
        if c['subject'] == department:
            subject_courses.append(c)
    
    if len(subject_courses) == 0:
        return jsonify({'error': 'Nothing found for that subject.'}), 404
    
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
    response = requests.get(api_url)
    if response.status_code != 200:
        return jsonify({'error': 'Failed to fetch data'}), response.status_code
    
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
        

if __name__ == '__main__':
    if "-dev" in sys.argv:
        app.run(debug=True)
        
    else:
        # app.run()
        from waitress import serve
        serve(app, host="0.0.0.0", port=5000, threads=20)
        