'use strict'

class Calendar {
    constructor(db) {
        // A list of all courses
        this.courses = []

        // A map of all courses
        this.coursesMap = null

        // A list of courses currently shown on the sidebar
        this.courses_shown = []

        // A list of courses currently not shown on the sidebar
        this.courses_hidden = []

        // A list of courses currently selected and shown on the calendar
        this.courses_oncalendar = []

        this.FCalendar = null
        this.db = db

        this.ghostCourses = []
        this.timetableghost = null

        this.datetime_retrieved = null

        this.courses_first_day = "2023-01-01"
        this.courses_last_day = null

        this.saveManager = new SaveManager()
        this.saveManager.loadSaves()
    }

    parseFromDB() {
        // clear current data
        this.courses = []

        //document.getElementById("courselist").textContent =''
        document.getElementById("searchResults").textContent = "Parsing courses..."
        console.log("Parsing section information from database.")

        // retrieve courses from loaded database
        this.courses = this.db.getSections()

        document.getElementById("searchResults").textContent = "Generating HTML..."
        console.log("Retrieved sections from database.")

        // hydrate courselist on sidebar
        let courselist = document.getElementById("courselist")
        courselist.innerHTML = ""

        // Generate map for quickly searching for courses.
        this.coursesMap = new Map()

        for (const c of this.courses) {
            c.Calendar = this
            c.generateFuzzySearch() // THIS IS BAD

            //courselist.appendChild(c.getCourseListHTML())

            this.coursesMap.set(c.id, c)
        }

        // update available semesters
        let termSelector = document.getElementById("termSelector")
        const sems = this.db.getAvailableSemesters()

        let inopt = []
        for (const t of termSelector) {
            inopt.unshift(t.value)
        }

        function intToStr(int) {
            if (int == 10)
                return "Spring"
            if (int == 20)
                return "Summer"
            if (int == 30)
                return "Fall"
        }

        for (const t of sems) {
            if (!inopt.includes(`${t[0]}-${t[1]}`))
                termSelector.add(new Option(`${t[0]} ${intToStr(t[1])}`, `${t[0]}-${t[1]}`))
        }

    }

    // Call when the term is changed
    // Sets the FCalendar date to the start of that term
    // TODO: also set the start / end date of each course on the calendar
    changeSemester() {
        let yearterm = document.getElementById("termSelector").value

        // If looking at all than date doesn't matter
        if (yearterm == "ALL")
            return

        const year = parseInt(yearterm.split("-")[0])
        const term = parseInt(yearterm.split("-")[1])

        const query = `SELECT start_date FROM Schedules WHERE year = ${year} AND term = ${term} AND start_date IS NOT NULL GROUP BY start_date ORDER BY COUNT(*) ASC;`
        let start_date = this.db.executeQuery(query)

        let start = start_date[0]
        //console.log(start_date)
        this.FCalendar.gotoDate(new Date(new Date(start).getTime() + 604800000))


    }

    // Generates a list of resources for the resourceview
    // This is a list of locations for each class - ie. A130, L215, etc, etc
    // Only needs to be called once when setting up FCalendar
    generateResources() {
        let unique_locations_set = new Set()

        for (const c of this.courses) {
            for (const sch of c.schedule) {
                unique_locations_set.add(sch.room)
            }
        }
        let unique_locations = [...unique_locations_set]
        unique_locations.sort()

        // format into resource structure used by FullCalendar
        let resources = []
        for (const location of unique_locations) {
            if (location == "TBSCH") {
                resources.push({
                    id: "TBSCH",
                    groupId: "?"
                })
            } else if (!["A", "B", "C", "G", "L", "T", "O", "W"].includes(location.slice(0, 1))) {
                //console.log("Unknown location found: " + location)
                resources.push({
                    id: location,
                    groupId: "?"
                })
            } else {
                resources.push({
                    id: location,
                    groupId: location.slice(0, 1)
                })
            }
        }
        return resources
    }

    calendarUpdate() {
        // don't autosave emptiness
        if (this.courses_oncalendar.length == 0)
            return

        let yearterm = document.getElementById("termSelector").value
        const year = parseInt(yearterm.split("-")[0])
        const term = parseInt(yearterm.split("-")[1])
        this.saveManager.editSave("autosave", year, term, this.courses_oncalendar.join("_"))
    }

    // Toggles visibility of course in calendar
    toggleFCalendar(id) {

        if (id == "")
            return

        let id_arr = id.split("_")

        for (const id of id_arr) {
            let c = this.coursesMap.get(id)


            let status = c.toggleFShown(this.FCalendar)
            c.ghost = false

            if (status) {
                this.courses_oncalendar.push(c.id)
                c.shown = true
            } else {
                const index = this.courses_oncalendar.findIndex(idd => idd == id);
                if (index !== -1) {
                    this.courses_oncalendar.splice(index, 1);
                }
                c.shown = false
                this.setGhostFCalendar(id, true)
            }

        }

        this.calendarUpdate()

    }

    setGhostFCalendar(id, skipClear = false) {
        if (this.ghostCourses == null || this.ghostCourses == undefined)
            this.ghostCourses = []

        let id_arr = []
        if (id != null)
            id_arr = id.split("_");

        if (!skipClear)
            this.clearAllGhosts();

        // Show ghosts for matching courses
        for (const cID of id_arr) {
            let c = this.coursesMap.get(cID)
            if (c.shown || c.ghost)
                continue
            c.showFCalendar(this.FCalendar, "dark-gray", id);
            c.ghost = true;
            this.ghostCourses.push(c)
        }
    }

    clearAllGhosts() {

        for (const c of this.ghostCourses) {
            if (c.shown && !c.ghost)
                continue
            c.hideFCalendar(this.FCalendar);
            c.ghost = false;
        }
        this.ghostCourses = []

    }


    showCourseInfo(id) {

        let c = this.coursesMap.get(id)

        let new_window = window.open("", "_blank", "toolbar=no,width=800,height=700")
        new_window.document.body.innerHTML = c.generateCourseInfoHTML()
    }

    // Toggles all courses
    toggleAllFCalendar(show) {
        let i = 0

        for (const c of this.courses_shown) {
            if (this.courses_shown.length > 3000 && i % 500 == 0)
                console.log(`${i}/${this.courses_shown.length}`)
            i += 1

            if (show) {
                c.showFCalendar(this.FCalendar)
                c.shown = true
                this.courses_oncalendar.push(c.id)
            } else {
                c.hideFCalendar(this.FCalendar)
                c.shown = false
                const index = this.courses_oncalendar.findIndex(idd => idd == c.id);
                if (index !== -1) {
                    this.courses_oncalendar.splice(index, 1);
                }
            }
        }

        this.calendarUpdate()
    }

    // called whenever we need to update the courselist
    // ie new search entered, different option set
    courselistUpdate() {

        let search = document.getElementById("courseSearchBar").value
        let yearterm = document.getElementById("termSelector").value

        this.filterCoursesBySearch(this.parseSearch(search), yearterm)
        this.reloadCourseList()
    }

    // INTERNAL FUNCTION - DO NOT CALL
    // parses a search string into an array of syntactically useful search terms
    parseSearch(string) {
        // must parse AND and OR
        const sep = "🖥️"
        console.assert(!string.includes(sep), "search string contains seperator character...why did you do that")

        const subjects = this.db.getSubjects()

        const aS = sep + "AND" + sep
        const oS = sep + "OR" + sep

        string = string.toLowerCase().replace("and", aS).replace("&&", aS).replace("&", aS).replace("or", oS).replace("||", oS).replace("|", oS)
        const split = string.split(sep)

        let results = new Array()

        let storedCondition = "OR"

        for (let term of split) {
            term = term.trim()

            if (term == "AND" || term == "&" || term == "&&") {
                storedCondition = "AND"
                continue
            } else if (term == "OR" || term == "||" || term == "|") {
                storedCondition = "OR"
                continue
            }

            if (term == "") {
                /* Do nothing */
            }

            // crn (5 digits and numeric)
            else if (term.length == 5 && /^\d+$/.test(term)) {
                results.push({
                    type: "crn",
                    condition: storedCondition,
                    search: term
                })
            }

            else if (term == "www" || term == "lab" || term == "lecture" || term == "exam" || term == "seminar" || term == "practicum") {
                results.push({
                    type: "schedule.type",
                    condition: storedCondition,
                    search: term
                })
            }

            else if (["2ar", "2sc", "hum", "lsc", "sci", "soc", "ut"].includes(term)) {
                results.push({
                    type: "course.attributes",
                    condition: storedCondition,
                    search: term
                })
            }


            else if (term.length == 4 && subjects.includes(term)) {
                results.push({
                    type: "subject",
                    condition: storedCondition,
                    search: term
                })
            }

            // if first 4 letter is string and last 4 letter are char, then match exactly
            else if (/^[a-z]{4} \d{4}$/.test(term)) {
                results.push({
                    type: "course",
                    condition: storedCondition,
                    search: term
                })

            }

            else {
                results.push({
                    type: "fuzzy",
                    condition: storedCondition,
                    search: term
                })
            }

            storedCondition = "OR"
        }
        return results
    }

    // INTERNAL FUNCTION - DO NOT CALL
    // filters courselists internally into courses_hidden and courses_shown
    filterCoursesBySearch(search, yearterm, use_calendar = true) {

        console.assert(Array.isArray(search), `Search array is not an array: ${search}`)
        let c_shown = []
        let c_hidden = []

        // reset internal search arrays
        // First search pass - filter by date and term.
        if (yearterm != "ALL") {
            const year = parseInt(yearterm.split("-")[0])
            const term = parseInt(yearterm.split("-")[1])

            c_shown = this.courses.filter(c => (c.year == year && c.semester == term));
            c_hidden = this.courses.filter(c => (c.year != year || c.semester != term));
        } else {
            c_shown = [...this.courses]
            c_hidden = []
        }

        const attributes = new Map([["2ar", 8], ["2sc", 9], ["hum", 10], ["lsc", 11], ["sci", 12], ["soc", 13], ["ut", 14]]);

        let c_filtered = new Set()

        for (const s of search) {
            console.assert(s.type != null && (s.condition == "AND" || s.condition == "OR") && s.search != null, `something wrong with search ${s}`)
            console.assert(s.type == "fuzzy" || s.type == "crn" || s.type == "schedule.type" || s.type == "subject" || s.type == "course" || s.type == "course.attributes", `something wrong with search ${s}`)

            let searchResult = []

            if (s.type == "crn") {
                searchResult = c_shown.filter(c => c.crn == s.search).map(c => c.id)
            }

            else if (s.type == "schedule.type") {
                searchResult = c_shown.filter(c => c.schedule.filter(sch => sch == s.type)).map(c => c.id)
            }

            else if (s.type == "course") {
                let subject = s.search.substring(0, 4).toUpperCase()
                let code = parseInt(s.search.slice(-4))

                searchResult = c_shown.filter(c => c.subject == subject && c.course_code == code).map(c => c.id)
            }

            else if (s.type == "course.attributes") {
                const i = attributes.get(s.search)

                searchResult = c_shown.filter(c => {
                    const courseInfo = this.db.getCourseInfos(c.subject, c.course_code);
                    return courseInfo[0] && courseInfo[0][i] === 1;
                }).map(c => c.id);
            }

            else if (s.type == "subject") {
                searchResult = c_shown.filter(c => c.subject == s.search).map(c => c.id)
            }

            else {
                let thresh = 0.2
                if (search.length >= 9)
                    thresh = 0.09

                const fuse_options = {
                    includeScore: true,
                    shouldSort: false,
                    threshold: thresh,
                    //useExtendedSearch: true,
                    ignoreLocation: true,
                    keys: [
                        "fuzzySearch"
                    ]
                }

                const fuse = new Fuse(c_shown, fuse_options)
                let fuseSearch = fuse.search(s.search)
                searchResult = fuseSearch.map(result => result.item.id)
            }

            //c_hidden.push(...this.courses_shown.filter(item => !matchedItems.includes(item)));
            //c_shown = this.courses_shown.filter(item => matchedItems.includes(item));
            if (s.condition == "OR") {
                searchResult.forEach(item => c_filtered.add(item))

            } else if (s.condition == "AND") {
                let new_filtered = new Set()

                for (const c of searchResult) {
                    if (c_filtered.has(c)) {
                        new_filtered.add(c)
                    }
                }

                c_filtered = new_filtered
            }
        }

        //console.log(search)
        //console.log(c_filtered)

        // turn the course ids back into course objects
        if (search.length >= 1) {
            c_hidden.push(...c_shown.filter(item => !c_filtered.has(item.id)))
            c_shown = c_shown.filter(item => c_filtered.has(item.id))
        }


        //console.log(c_hidden, c_shown)

        // hide courses that conflict by schedule
        let conflicts = document.getElementById("conflictCheckbox").checked

        if (conflicts && use_calendar) {

            // only check conflicts for required courses
            for (const courseID of [...this.courses_oncalendar]) {

                let course = this.coursesMap.get(courseID)

                for (const potential_course of [...c_shown]) {

                    const conflict = this.findTimeConflict(course, potential_course)
                    //console.log(conflict, potential_course, shown_course)

                    if (conflict) {
                        let remove = c_shown.indexOf(potential_course)
                        c_shown.splice(remove, 1)
                        c_hidden.push(potential_course)
                    }
                }
            }

        }

        // force re-add courses that are selected
        if (use_calendar) {
            for (const cID of this.courses_oncalendar) {
                const c = this.coursesMap.get(cID)
                if (c_hidden.indexOf(c) != -1) {
                    let remove = c_hidden.indexOf(c)
                    c_hidden.splice(remove, 1)
                    c_shown.push(c)
                }
            }

            this.courses_shown = c_shown
            this.courses_hidden = c_hidden
        }

        return c_shown


    }

    // takes 2 Course's and determines if they conflict.
    // returns true if conflict found, false if there is no conflict
    findTimeConflict(course1, course2) {
        //console.log(course1, course2)
        // divide time into 7 days of 10 minute chunks (7 * (24 * 60)/10 = 1008)
        // bad long term solution, but it is performant for now
        // note that this will break if langara switches to twelve hour time

        const time = new Array(1008) // 144 * 7
        time.fill(false)

        const schedules = [...course1.schedule, ...course2.schedule];

        for (const sch of schedules) {

            // Looking for conflicts on exams is not useful
            if (sch.type == "Exam")
                continue

            // Don't need to check schedules that don't have a set time
            if (sch.time == "-" || sch.time == " ")
                continue

            let starthour = +sch.time.slice(0, 2)
            let startmin = +sch.time.slice(2, 4)
            let endhour = +sch.time.slice(5, 7)
            let endmin = +sch.time.slice(7, 10)

            // turn :25 -> :20
            startmin = Math.round((startmin - 1) / 10) * 10
            // turn :25 -> :30
            endmin = Math.round((endmin + 1) / 10) * 10

            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {

                if (sch.days[dayIndex] == '-')
                    continue

                const start = (144 * dayIndex) + ((starthour * 60) / 10) + (startmin / 10)
                const end = (144 * dayIndex) + ((endhour * 60) / 10) + (endmin / 10)

                console.assert(end > start, "Time conflict checker failed unexpectedly.", course1, course2)

                for (let i = start; i <= end; i++) {
                    if (time[i])
                        return true
                    time[i] = true
                }
            }
        }
        return false
    }



    hideCourse(c) {
        this.courses_hidden.push(c)
        this.courses_shown.splice(this.courses_shown.indexOf(c), 1)
    }



    // extracts dates from a search query (ie given "CPSC Sun Saturday", returns ["CPSC", 6, 7])
    dateExtractor(string) {

        const lookup = {
            "mo": 1,
            "mon": 1,
            "monday": 1,
            "tu": 2,
            "tue": 2,
            "tuesday": 2,
            "we": 3,
            "wed": 3,
            "wednesday": 3,
            "th": 4,
            "thu": 4,
            "thursday": 4,
            "fr": 5,
            "fri": 5,
            "friday": 5,
            "sa": 6,
            "sat": 6,
            "saturday": 6,
            "su": 7,
            "sun": 7,
            "sunday": 7,
        }

        const split = string.split(" ")

        let out = ""
        let days = []
        let days_out = {
            1: false,
            2: false,
            3: false,
            4: false,
            5: false,
            6: false,
            7: false,
        }
        let day_param_found = false

        for (const term of split) {
            if (term.toLowerCase() in lookup) {
                days_out[lookup[term]] = true
                day_param_found = true
            } else
                out += term + " "
        }

        if (!day_param_found) {
            for (const i in days_out)
                days_out[i] = true
        }

        return [out, day_param_found, days_out]
    }

    reloadCourseList() {
        const count = this.courses_shown.length;
        const results = document.getElementById("searchResults");
        const maxShown = CONSTANTS["max_shown_courses"];

        const fragment = document.createDocumentFragment(); // Create a document fragment to batch DOM updates

        if (count == 0) {
            results.innerText = "No courses found. Try a different search query!";
        } else if (count >= maxShown) {
            results.innerText = `${count} courses found. Only rendering ${maxShown} courses to reduce lag.`;
        } else {
            results.innerText = `${count} courses shown.`;
        }

        // Hide all courses
        for (const c of this.courses_shown) {
            c.getCourseListHTML().classList.add("hidden");
        }

        // Show filtered courses and add them to the fragment
        let i = 0;
        for (const c of this.courses_shown) {
            c.getCourseListHTML().classList.remove("hidden");
            i += 1;
            if (i > maxShown) break;
            fragment.appendChild(c.getCourseListHTML()); // Add the course element to the document fragment
        }

        // Replace the content of the courselist container with the fragment
        const courselist = document.getElementById("courselist");
        courselist.innerHTML = ''; // Clear the current content
        courselist.appendChild(fragment); // Add the fragment to the DOM in a single operation
    }


    getTimetableInput() {
        const yearterm = document.getElementById("termSelector2").value;
        const queryElements = Array.from(document.querySelectorAll('[id^="timetableField"]'));
        const queries = queryElements.map((element) => element.value);

        let results = queries
            .filter((query) => query !== "")
            .map((query) => this.filterCoursesBySearch(this.parseSearch(query), yearterm, false));

        results.sort((a, b) => a.length - b.length)

        let timetables = this.combineCourses(results)

        timetables = Array.from(new Set(timetables)).sort();


        let crns = new Set()
        for (const t of timetables) {
            let str = ""
            for (const c of t)
                str += `${c.crn}`

            if (crns.has(str))
                continue
            crns.add(str)
        }

        //console.log("TIMETABLES", timetables, crns)


        let msg = ""
        const len = crns.size
        const MAX_TIMETABLES = 20

        if (len == 0) {
            msg = "Could not create a time table for that query."
        } else if (len <= MAX_TIMETABLES) {
            msg = `${len} possible time tables found.`
        } else if (len > MAX_TIMETABLES) {
            msg = `${len} possible time tables found. Displaying the first ${MAX_TIMETABLES}.`
        }

        document.getElementById("timetableText").textContent = msg

        const courseList = document.getElementById("timetablecourselist")
        courseList.innerHTML = ""

        crns = new Set()

        for (const t of timetables) {

            // don't display duplicate timetables
            let str = ""
            for (const c of t)
                str += `${c.crn}`

            if (crns.has(str))
                continue
            crns.add(str)

            let ids = []

            let crn_str = ""
            for (const c of t)
                crn_str += `${c.crn} `


            let html = "<div>"
            html += `<p><b>CRNS: ${crn_str}</b></p>`
            for (const c of t) {
                html += `<b>${c.subject} ${c.course_code} ${c.crn}</b>`

                for (const sch of c.schedule) {
                    html += `<p>${sch.type} ${sch.days} ${sch.time} ${sch.room} ${sch.instructor}</p>`
                }
                ids.push(c.id)
            }
            html += "</div>"

            let temp = document.createElement('div');
            temp.className = `csidebar`
            temp.innerHTML = html
            temp.id = ids.join("_")

            courseList.appendChild(temp)
        }

        //console.log(results, timetables);
    }

    combineCourses(coursesList, index = 0, currentTimetable = new Set(), allTimetables = new Set()) {
        if (index === coursesList.length) {
            allTimetables.add([...currentTimetable]);
            return;
        }

        for (const course of coursesList[index]) {
            if (this.isCourseAvailable(currentTimetable, course)) {
                currentTimetable.add(course);
                this.combineCourses(coursesList, index + 1, currentTimetable, allTimetables);
                currentTimetable.delete(course);
            }
        }

        return allTimetables;
    }

    isCourseAvailable(currentTimetable, course) {
        for (const existingCourse of currentTimetable) {
            if (this.findTimeConflict(existingCourse, course)) {
                return false; // There is a time conflict, so the course is not available
            }
        }

        return true; // No time conflicts found, so the course is available
    }

    areArraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) {
            return false;
        }

        for (let i = 0; i < arr1.length; i++) {
            if (JSON.stringify(arr1[i]) !== JSON.stringify(arr2[i])) {
                return false;
            }
        }

        return true;
    }

    removeDuplicateSubarrays(arrayOfArrays) {
        const uniqueArrays = [];
        for (const subarray of arrayOfArrays) {
            let isDuplicate = false;
            for (const uniqueArray of uniqueArrays) {
                if (areArraysEqual(subarray, uniqueArray)) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                uniqueArrays.push(subarray);
            }
        }
        return uniqueArrays;
    }

    showSaves() {
        const target = document.getElementById("savedSchedulesList")
        target.innerHTML = ""

        for (const s of this.saveManager.saves) {
            const node = s.generateSidebarHTML(this.coursesMap)

            const t = this
            function func() {
                t.toggleFCalendar(node.id)
            }

            function func2(event) {
                t.setGhostFCalendar(node.id)
            }

            function func3(event) {
                t.clearAllGhosts()
            }
            node.childNodes[0].addEventListener("mouseover", func2)
            node.childNodes[0].addEventListener("mouseleave", func3)
            node.childNodes[0].addEventListener("click", func)
            node.childNodes[1].addEventListener("click", function (event) {
                const name = event.target.parentElement.getAttribute("savename")
                if (!confirm(`Are you sure you want to delete ${name}?`))
                    return
                c.saveManager.deleteSave(name)
                c.showSaves()
            })

            target.appendChild(node)
        }
    }



}

