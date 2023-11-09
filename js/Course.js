function format_data(data) {
    if (data === null)
        return ""
    return data

}

class Schedule {
    constructor(data) {
        if (data.length != 7) {
            console.log(data)
            alert("Schedule information loaded from database is wrong length.")
        }

        this.type = data[0]
        this.days = data[1]
        this.time = data[2]
        this.start_date = data[3]
        this.end_date = data[4]
        this.room = data[5]
        this.instructor = data[6]
    }
}


class Course {
    constructor(data, schedules) {

        if (data.length != 14) {
            console.log(data)
            alert("Section information loaded from database is wrong length.")
        }

        this.year = data[0]
        this.semester = data[1]

        this.RP = data[2]
        this.seats = data[3]
        this.waitlist = data[4]
        this.crn = data[5]
        this.subject = data[6]
        this.course_code = data[7]
        this.section = data[8]
        this.credits = data[9]
        this.title = data[10]
        this.add_fees = data[11]
        this.rpt_limit = data[12]
        this.notes = data[13]

        this.schedule = []

        for (const sch of schedules) {
            this.schedule.push(new Schedule(sch))
        }

        // An ID that uniquely identifies a section of a course in the database
        this.id = `${this.year}-${this.semester}-${this.crn}`
        this.shown = false
        this.ghost = false
        this.courseListHTML = null

        let temp = false
        for (const sch of this.schedule) {
            if (sch.days.includes("S")) {
                temp = true
                break
            }
        }
        this.hasWeekend = temp

    }


    toString() {
        let out = `${this.RP} ${this.seats} ${this.waitlist} ${this.crn} ${this.subject} ${this.course_code} ${this.section} ${this.credits} ${this.title} ${this.add_fees}`

        for (const s of this.schedule) {
            out += "\n" + `\t${s.type} ${s.days} ${s.time} ${s.start} ${s.end} ${s.room} ${s.instructor}`
        }

        return out
    }

    fmtCC(course_code) {
        if (course_code < 1000 && course_code > 9)
            return `00${course_code}`
        return course_code
    }

    getCourseListHTML() {
        if (this.courseListHTML == null)
            this.courseListHTML = this.generateCourseListHTML()

        return this.courseListHTML
    }


    // INTERNAL USE ONLY
    // html in the courselist on the sidebar
    generateCourseListHTML() {

        let scheduleHTML = "<div>"

        for (const sch of this.schedule) {
            scheduleHTML += `<p>${sch.type} ${sch.days} ${sch.time} ${sch.room} ${sch.instructor}</p>`
        }
        scheduleHTML += "</div>"

        if (!(this.notes === null)) {
            scheduleHTML += `<p class="notes">${this.notes}</p>`
        }

        let html = `
            <h3>${this.subject} ${this.fmtCC(this.course_code)} ${this.section} : ${this.title}</h3>
        `
        let color = ""

        if (this.seats == "Cancel") {
            html += `<p>Cancelled.</p>`
            color = "red"
        } else if (this.seats != 0 && this.waitlist == "Full") {
            html += `<p>${this.seats} seats available. Waitlist is full.</p>`
            color = "yellow"
        } else if (this.seats == 0 && this.waitlist == "Full") {
            html += `<p>Seats and waitlist are full.</p>`
            color = "red"
        } else if (this.seats != 0 && (this.waitlist == " " || this.waitlist == "" || this.waitlist == null || this.waitlist == "null")) {
            html += `<p>${this.seats} seats available.</p>`
            color = "green"
        } else if (this.waitlist == "N/A") {
            html += `<p>${this.seats} seats available. Waitlist N/A.</p>`
            color = "yellow"
        } else if (this.seats != 0 && this.waitlist != "Full") {
            html += `<p>${this.seats} seats available. ${this.waitlist} on waitlist.</p>`
            color = "yellow"
        } else if (this.seats == 0 && this.waitlist > 30) {
            // if waitlist is above 30 you very likely aren't getting through 
            html += `<p>${this.seats} seats available. ${this.waitlist} on waitlist.</p>`
            color = "red"
        } else if (this.seats == 0 && this.waitlist != "Full") {
            html += `<p>No seats available. ${this.waitlist} on waitlist.</p>`
            color = "yellow"
        }
        html += scheduleHTML

        let temp = document.createElement('div');
        temp.innerHTML = html
        temp.id = this.id

        temp.className = `csidebar hidden ${color}`
        if (!document.getElementById("showColors").checked) {
            temp.classList.add("gray")
        }

        return temp
    }



    // html for the course info that opens in a new window
    generateCourseInfoHTML() {

        let html = "<!DOCTYPE html>"
        html += `<style>
        h2 {margin-bottom: 2px;}
        .grid {max-width:90vw; display: grid; grid: auto auto/ fit-content(100%) fit-content(100%);}
        .sched {max-width:90vw; display: grid; grid: auto / repeat(7, fit-content(100%));}
        div > * {border: 1px solid #000; padding-right: 5px; padding-left: 5px; padding-top:2px; padding-bottom:2px; margin: 0;}
        iframe {width:90vw; height: 300px; padding: 10px;}
        
        .red {background-color: rgb(253, 167, 167);}
        .yellow {background-color: rgb(241, 241, 162);}
        .green {background-color: rgb(126, 198, 126);} 
        table {
            border-collapse: collapse;
        }
        table > td, tbody > * {
            vertical-align: top;
            text-align: left;
        }    
        th, td {
            border: 1px solid #000;
            text-align: left;
            padding: 5px;
        }
                
        #transferTable {
            width: fit-content;
            table-layout: fixed;
        }
        .tablePriority {
            min-width: max-content;
        }

        .offeredTable {
            width: fit-content;
        }
        </style>`

        let courseInfo = this.Calendar.db.getCourseInfos(this.subject, this.course_code)
        let previousOfferings = this.Calendar.db.getSections(null, null, null, this.subject, this.course_code)
        let transferInfo = this.Calendar.db.getTransfers(this.subject, this.course_code)

        courseInfo = courseInfo[0]

        console.log(this, courseInfo, previousOfferings, transferInfo)

        function un(value) {
            if (value == null || value == undefined)
                return ""
            return value
        }

        if (courseInfo == undefined) {
            html += `<h2><a href="https://langara.ca/programs-and-courses/courses/${this.subject}/${this.fmtCC(this.course_code)}.html">${this.subject} ${this.fmtCC(this.course_code)} ${this.year}${this.semester} ${this.section} ${this.crn}: ${this.title}</a></h2>`
            html += `<p>No description found.</p>`
        } else {
            html += `<h2><a href="https://langara.ca/programs-and-courses/courses/${this.subject}/${this.course_code}.html">${this.subject} ${this.course_code} ${this.year}${this.semester} ${this.section} ${this.crn}: ${courseInfo[3]}</a></h2>`
            html += `<p>${courseInfo[4]}</p>`
        }

        html += "<h2>Section Information</h2>"

        html += `<div class="sched">`
        html += `<p>Type</p><p>Day(s)</p><p>Time</p><p>Non Standard Start</p><p>Non Standard End</p><p>Room</p><p>Instructor(s)</p>`
        for (const sch of this.schedule) {
            html += `<p>${sch.type}</p><p>${sch.days}</p><p>${sch.time}</p><p>${un(sch.start_date)}</p><p>${un(sch.end)}</p><p>${sch.room}</p><p>${sch.instructor}</p>`
        }
        html += "</div><br>"

        html += `<div class="grid">`
        html += `<p>RP</p><p>${un(this.RP)}</p>`
        html += `<p>Seats Available</p><p>${un(this.seats)}</p>`
        html += `<p># On Waitlist</p><p>${un(this.waitlist)}</p>`
        html += `<p>CRN</p><p>${this.crn}</p>`
        html += `<p>Subject</p><p>${this.subject}</p>`
        html += `<p>Course</p><p>${this.fmtCC(this.course_code)}</p>`
        html += `<p>Section</p><p>${this.section}</p>`
        html += `<p>Credits</p><p>${this.credits}</p>`
        html += `<p>Title</p><p>${this.title}</p>`
        html += `<p>Additional Fees</p><p>${un(this.add_fees)}</p>`
        html += `<p>Repeat Limit</p><p>${un(this.rpt_limit)}</p>`
        html += `<p>Notes</p><p>${un(this.notes)}</p>`
        html += "</div>"


        html += "<h2>Course Information</h2>"


        if (courseInfo == null)
            html += "<p><b>No course attributes available.</b></p>"
        else {
            function attrColor(i) {
                if (courseInfo[i])
                    return "green"
                else
                    return ""
            }

            function fA(i) {
                if (courseInfo[i] === null || courseInfo[i] == 0)
                    return "no"
                return "yes"
            }

            html += `
            <table>
                <tr> 
                    <th class=${attrColor(8)}>2AR</th> 
                    <th class=${attrColor(9)}>2SC</th> 
                    <th class=${attrColor(10)}>HUM</th> 
                    <th class=${attrColor(11)}>LSC</th> 
                    <th class=${attrColor(12)}>SCI</th> 
                    <th class=${attrColor(13)}>SOC</th> 
                    <th class=${attrColor(14)}>UT</th> 
                </tr>
                <tr>
                    <td class=${attrColor(8)}>${fA(8)}</td>
                    <td class=${attrColor(9)}>${fA(9)}</td>
                    <td class=${attrColor(10)}>${fA(10)}</td>
                    <td class=${attrColor(11)}>${fA(11)}</td>
                    <td class=${attrColor(12)}>${fA(12)}</td>
                    <td class=${attrColor(13)}>${fA(13)}</td>
                    <td class=${attrColor(14)}>${fA(14)}</td>
            </table>
            <br>
            `
        }

        if (transferInfo.length == 0) {
            html += "<p><b>No transfer agreements found.</b></p>"
        } else {
            html += `<table class="transferTable"> 
            <th>Course</th><th>Destination</th><th>Credit</th><th>Start/End</th>
            `

            for (t of transferInfo) {

                let classes = ""
                if (t[6] != "present")
                    classes += "hidden "

                if (t[4] == "No credit" || (t[4] == "No Credit"))
                    classes += "red "

                //if (t.credit != undefined)
                //    console.log(t.credit.split("(").at(-1).split(")").at(0))

                // yellow on ind assessment or if you only get partial credits for transfer
                if (t[4] == "Individual assessment." || (t[4] != undefined && parseFloat(t[4].split("(").at(-1).split(")").at(0)) < parseFloat(this.credits)))
                    classes += "yellow "

                html += `
                    <tr class="${classes} ${t[3]}">
                        <td class="tablePriority">${t[0]} ${t[1]}</td>
                        <td class="tablePriority">${t[3]}</td>
                        <td>${t[4]}</td>
                        <td class="tablePriority">${un(t[5])} to ${un(t[6])}</td>
                    </tr>
                `
            }
            html += `</table>`
        }

        if (previousOfferings == []) {
            html += "<p><b>No previous offerings found.</b></p>"
        } else {

            let sems = new Set()
            for (let c of previousOfferings)
                sems.add(`${c.year}${c.semester}`)
            html += `<p>Previously offered : ${[...sems].join(", ")}.</p>`

            html += `<table class="offeredTable mono"> 
            <thead><th>Semester</th> <th>Seats</th> <th>Waitlist</th> <th>Days</th> <th>Time</th> <th>Room</th> <th>Type</th> <th>Instructor</th></thead>
            `

            for (const c of previousOfferings) {
                html += `<tbody>`
                let s = []
                for (const sch of c.schedule) {
                    s.push(`
                    <td>${sch.days}</td> 
                    <td>${sch.time}</td> 
                    <td>${sch.room}</td> 
                    <td>${sch.type}</td>  
                    <td>${sch.instructor}</td> `
                    )
                }

                html += `<tr>
                    <td rowspan="${s.length}">${c.year}${c.semester}</td>
                    <td rowspan="${s.length}">${un(c.seats)}</td>
                    <td rowspan="${s.length}">${un(c.waitlist)}</td>            
                    ${s[0]}
                    </tr>
                `
                for (const string of s.slice(1)) {
                    html += `<tr>${string}</tr>`
                }
                html += `</tbody>`
            }

            html += `</table>`
        }

        return html
    }

    toggleFShown(FCalendar) {
        // TODO: automatically show weekends if a saturday course is clicked, and weekends is not enabled
        if (this.ghost) {
            this.hideFCalendar(FCalendar)
            this.showFCalendar(FCalendar)
            return true
        } else if (this.shown) {
            this.hideFCalendar(FCalendar)
            return false
        } else {
            this.showFCalendar(FCalendar)
            return true
        }

    }

    hideFCalendar(FCalendar, color_class = "blue", sourceElementID) {
        // getEventById only returns one event at a time
        // but getEvents doesn't get events that aren't currently shown so it doesn't work
        while (FCalendar.getEventById(this.id) != null)
            FCalendar.getEventById(this.id).remove()

        this.shown = false
        // fix weird bug with changing terms - i should fix this properly at some point

        let colorChange = sourceElementID == null ? this.id : sourceElementID

        try {
            if (document.getElementById(colorChange) != null) {
                document.getElementById(colorChange).classList.remove(color_class)
                document.getElementById(colorChange).classList.remove("dark-gray") // TODO: workaround to fix ghosting, should fix this properly in the future
                //document.getElementById(this.id).style.backgroundColor = null // change the color of the courselist div back to normal
            }
        } catch (error) {
            console.log("ERROR:", error)
        }


        let show_weekends = false
        for (const id of this.Calendar.courses_oncalendar) {
            let c = this.Calendar.coursesMap.get(id)

            if (c.hasWeekend) {
                show_weekends = true
                break
            }
        }
        if (show_weekends == false && !document.getElementById("weekendCheckbox").checked) {
            FCalendar.setOption('hiddenDays', [0, 6])
        }

    }

    showFCalendar(FCalendar, color_class = "blue", sourceElementID) {

        // This looks like technical debt that I will pay for but it is a quick fix
        if (this.shown)
            return

        for (const sch of this.schedule) {

            if (sch.days === "-------") {
                continue // if there's no time slot then we don't need to render it
            }
            if (sch.days.trim() === "") {
                // console.log("No time data for .ghost", this)
                continue // cancelled courses have no time data
            }

            if (this.hasWeekend) {
                FCalendar.setOption('hiddenDays', [0])
            }

            // convert M-W---- to [1, 3]
            let value = 1
            let days = []
            for (const c of sch.days) {
                if (!(c === '-')) {
                    days.push(value)
                }
                value = (value + 1) % 7
            }

            let times = sch.time.split("-")
            let s_time = times[0].slice(0, 2) + ":" + times[0].slice(2, 4)
            let e_time = times[1].slice(0, 2) + ":" + times[1].slice(2, 4)

            let start = null
            if (sch.start_date !== null)
                start = new Date(sch.start_date)
            else if (this.Calendar.courses_first_day !== null)
                start = this.Calendar.courses_first_day

            let end = null
            if (sch.end_date !== null)
                end = new Date(sch.end_date)
            else if (this.Calendar.courses_last_day !== null)
                end = new Date(this.Calendar.courses_last_day)
            else if (start !== null) 
                end = new Date(start.getTime() + 3600000 * 24 * 7 * 12) // 14 weeks in ms
            
            if (end != null)
                end = new Date(end.getTime() + 86400000)

            //console.log(new Date(sch.start_date), sch.start_date, sch.end_date)
            
            let f = {
                id: this.id,
                title: `${this.subject} ${this.course_code} ${this.crn}`,
                description: `${this.subject} ${this.course_code} ${this.section} ${this.crn} <br> ${sch.type} ${sch.room}`,
                startRecur: start,
                endRecur: end, // add 24 hours to the date to show 1 day events
                daysOfWeek: days,
                startTime: s_time,
                endTime: e_time,
                classNames: ["calendartxt", `${this.id}fc`, color_class],
                resourceId: sch.room,
                overlap: false,
                extendedProps: {
                    course_code: this
                },
                source: "json"
            }

            FCalendar.addEvent(f)

            //console.log(f)

        }

        let colorChange = sourceElementID == null ? this.id : sourceElementID

        try {
            if (!document.getElementById(colorChange).hasAttribute("savename"))
                document.getElementById(colorChange).classList.add(color_class)
        } catch (error) {
            // I cannot fix this right now, too much abstraction, its horrible, i need to learn react
            //console.log("ERROR:", error)
        }
    }


}