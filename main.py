from flask import Flask, abort, redirect, render_template, jsonify, request, send_from_directory
from flask_compress import Compress
import requests
import sys
from datetime import timedelta
from collections import defaultdict
import requests_cache
import time

requests_cache.install_cache(
    'demo_cache',
    use_cache_dir=True,                # Save files in the default user cache dir
    cache_control=True,                # Use Cache-Control response headers for expiration, if available
    expire_after=timedelta(days=1),    # Otherwise expire responses after one day
    allowable_codes=[200, 400],        # Cache 400 responses as a solemn reminder of your failures
    allowable_methods=['GET', 'POST'], # Cache whatever HTTP methods you want
    # ignored_parameters=['api_key'],    # Don't match this request param, and redact if from the cache
    match_headers=['Accept-Language'], # Cache a different response per language
    stale_if_error=True,               # In case of request errors, use stale cache data if possible)
)

ALL_COURSES: list[str] = []
SUBJECT_CODES: list[str] = []
# API_URL = f"http://127.0.0.1:8000"
API_URL = f"https://coursesapi.langaracs.ca"

app = Flask(
    __name__, 
    static_folder='static', 
    template_folder='templates'
)
Compress(app) # gzipping

# Exception class
class APIProblem(Exception):
    def __init__(self, message, status_code, payload=None):
        super().__init__()
        self.message = message
        self.status_code = status_code
        self.payload = payload

@app.errorhandler(APIProblem)
def handle_bad_request(error: APIProblem):
    response = jsonify(error.payload)
    response.status_code = error.status_code
    return render_template('error.html', status_code=error.status_code, error_message=error.message), error.status_code

# Updated api_request function
def api_request(api_url) -> dict:
    with requests_cache.enabled(
        'demo_cache', 
        expire_after=timedelta(days=1), 
        allowable_codes=[200, 400], 
        allowable_methods=['GET', 'POST'],
        cache_control=True,
        stale_if_error=True,
    ):
        try:
            response = requests.get(api_url)
            if response.status_code != 200:
                raise APIProblem("Failed to fetch data", 500, response)
            return response.json()
        except Exception as e:
            raise APIProblem("Failed to fetch data", 500, str(e))

# Fetch initial data using api_request
def updateGlobals():
    data = api_request(API_URL + "/v1/index/courses")
    for course in data['courses']:
        ALL_COURSES.append(f'{course["subject"]} {course["course_code"]}')
        if course["subject"] not in SUBJECT_CODES:
            SUBJECT_CODES.append(course["subject"])
updateGlobals()

# Routes
@app.route('/')
def index():
    yearterm = request.args.get('term', default=None, type=str)
    if yearterm != None and (len(yearterm) != 6 or not yearterm.isdigit()):
        raise APIProblem("Invalid term. Must follow year + term format. e.g. (202510)", 404)

    index_semesters = api_request(API_URL + "/v1/index/semesters")["semesters"]
    transfer_destinations = api_request(API_URL + "/v1/index/transfer_destinations")["transfers"]
    latest_semester = api_request(API_URL + "/v1/index/latest_semester")
    
    year = None
    term = None
    
    if yearterm == None:
        year, term = latest_semester['year'], latest_semester['term']
    else:
        year, term = int(yearterm[:4]), int(yearterm[4:6])
        
    if term not in [10, 20, 30]:
        raise APIProblem("Term must be 10, 20, or 30.", 404)

    if year < 1999 or year > latest_semester['year']:
        raise APIProblem("Couldn't find that semester", 404)

    
    latest_courses = api_request(API_URL + f"/v1/semester/{year}/{term}/courses")["courses"]
    latest_sections = api_request(API_URL + f"/v1/semester/{year}/{term}/sections")["sections"]

    # map each sections to the course object because that makes our life easier
    sections_dict = defaultdict(list)
    for section in latest_sections:
        key = (section['subject'], section['course_code'])
        sections_dict[key].append(section)

    for course in latest_courses:
        key = (course['subject'], course['course_code'])
        course["sections"] = sections_dict.get(key, [])

    return render_template('planner.html', year=year, term=term, latest_semester=latest_semester, courses=latest_courses,
                           transfer_destinations=transfer_destinations, semesters=index_semesters)

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

@app.template_filter()
def num_to_term(value):
    if value == 10:
        return "Spring"
    if value == 20:
        return "Summer"
    if value == 30:
        return "Fall"

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
                    text_split[i] = f"<a href='/courses/{current_subject}/{word}'>{current_subject} {word}</a>"
                    distance_since_subject_update = ARBITRARY_BIG_NUMBER
                else:
                    text_split[i] = f"<a href='/courses/{current_subject}/{word}'>{word}</a>"
    
    while None in text_split:
        text_split.remove(None)
        
    return "".join(text_split)


    
@app.route('/courses')
def all_courses():
    data = api_request(API_URL + "/v1/index/courses")
    
    subjects = {}
    active_c = 0
    active_s = 0
    
    for course in data['courses']:
        if course['subject'] not in subjects:
            subjects[course['subject']] = ([], [])
       
        if course["on_langara_website"]:
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
@app.route('/courses/<department>', strict_slashes=False)
def subject(department:str):
    data = api_request(API_URL + "/v1/index/courses")
            
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
        if c["on_langara_website"]:
            active_courses.append(c)
        else:
            inactive_courses.append(c)
    
    return render_template('subject.html', subject=department, active_courses=active_courses, inactive_courses=inactive_courses)
        

# route for getting specific course
@app.route('/courses/<department>/<course_number>')
def course(department, course_number):
    data = api_request(f"{API_URL}/v1/courses/{department}/{course_number}")
        
    # must be parsed here, its not possible to extract in the jinja template

    current_term = api_request(f"{API_URL}/v1/index/latest_semester")
    
    updateGlobals()
    
    # for c in data["offerings"]:
    #     c["year"] = int(c['id'].split("-")[3])
    #     c["term"] = int(c['id'].split("-")[4])
    
    
    offered_in_current_semester = [s for s in data["sections"] if s['year'] == current_term['year'] and s['term'] == current_term['term']]
    old_offerings = [s for s in data["sections"] if s['year'] != current_term['year'] or s['term'] != current_term['term']]
    old_offerings.reverse()
        
    current_transfers = [t for t in data["transfers"] if t["effective_end"] == None]
    inactive_transfers = [t for t in data["transfers"] if t["effective_end"] != None]
    
    # print(data['attributes'])
    
    if data['attributes']["title"] == "" or data['attributes']["title"] == None:
        data['attributes']["title"] = data['attributes']["abbreviated_title"]
        
    return render_template('course.html', subject=data['subject'], course_code=data['course_code'], course_info=data['attributes'], transfers=current_transfers, inactive_transfers=inactive_transfers, offerings=old_offerings, current_offerings=offered_in_current_semester, current_term=current_term, outlines=data['outlines'])


# route for getting specific course
@app.route('/transfers')
def all_transfer():
    data = api_request(f"{API_URL}/v1/index/transfer_destinations")['transfers']
        
    # must be parsed here, its not possible to extract in the jinja template

    return render_template('all_transfers.html', transfers=data)
            

# route for getting specific course
@app.route('/transfers/<institution>')
def transfer(institution):
    institution = institution.upper()
    data = api_request(f"{API_URL}/v1/transfers/{institution}")['transfers']
    
    institutions = api_request(f"{API_URL}/v1/index/transfer_destinations")['transfers']
    # print(institutions)
    
    institution_name = None
    for i in institutions:
        if i['code'] == institution:
            institution_name = i['name']
            
    if institution_name == None:
        raise APIProblem(f"Couldn't find transfer institution {institution}.", 404)
    
    # must be parsed here, its not possible to extract in the jinja template
    
    active_transfers = []
    inactive_transfers = []
        
    for t in data:
        if t["effective_end"] == None:
            active_transfers.append(t)
        else:
            inactive_transfers.append(t)
    
    return render_template('transfer.html', institution_name=institution_name, institution=institution, active_transfers=active_transfers, inactive_transfers=inactive_transfers)
            
# @app.route('/utilities/campus')
# def campus_population():
#     response = api_request(f"{API_URL}/v1/courses/index/semesters")
    
#     data = response.json()
#     data = data['semesters']
        
#     years = []
#     for term in data:
#         if term["year"] not in years:
#             years.append(term["year"])
    
#     return render_template('utilities/index.html', years=years)

if __name__ == '__main__':
    print(f"Starting frontend with {len(ALL_COURSES)} cached courses.")

    if "-dev" in sys.argv:
        app.run(debug=True)
        
    else:
        # app.run()
        from waitress import serve
        serve(app, host="0.0.0.0", port=5000, threads=20)
        
