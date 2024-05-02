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
    return "yes" if value else "no"


# route for getting specific course
@app.route('/courses/<department>/<course_number>')
def course(department, course_number):
    api_url = f"http://api2.langaracs.tech/data/{department}/{course_number}"
    response = requests.get(api_url)
    if response.status_code == 200:
        data = response.json()
        
        # must be parsed here, its not possible to extract in the jinja template

        current_term = requests.get("https://api2.langaracs.tech/meta/current_semester")
        current_term = current_term.json()
        
        offered_in_current_semester = [c for c in data["offerings"] if c['year'] == current_term['year'] and c['term'] == current_term['term']]
        old_offerings = [c for c in data["offerings"] if c['year'] != current_term['year'] or c['term'] != current_term['term']]
        old_offerings.reverse()
        
        return render_template('course.html', course_info=data['courseInfo'], transfers=data['transfers'], offerings=old_offerings, current_offerings=offered_in_current_semester, current_term=current_term)
    else:
        return jsonify({'error': 'Failed to fetch data'}), response.status_code

if __name__ == '__main__':
    if "-dev" in sys.argv:
        app.run(debug=True)
        
    else:
        app.run()
        # from waitress import serve
        # serve(app, host="0.0.0.0", port=5000, threads=20)
        