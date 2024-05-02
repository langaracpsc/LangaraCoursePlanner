from flask import Flask, render_template, jsonify, request, send_from_directory
import requests

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


# route for getting specific course
@app.route('/course/<department>/<course_number>')
def course(department, course_number):
    api_url = f"http://api2.langaracs.tech/data/{department}/{course_number}"
    response = requests.get(api_url)
    if response.status_code == 200:
        data = response.json()
        return render_template('course.html', course_info=data['courseInfo'], transfers=data['transfers'], offerings=data['offerings'])
    else:
        return jsonify({'error': 'Failed to fetch data'}), response.status_code

if __name__ == '__main__':
    from waitress import serve
    serve(app, host="0.0.0.0", port=5000, threads=20)
    
    # app.run(debug=True)
