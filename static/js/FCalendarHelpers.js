'use strict'


function showFCalendar(FCalendar, section_object, color_class = "#9ac7f7", semester_first_day="1970-01-01T00:00:00Z", semester_last_day="2025-02-03T00:00:00Z") {
    // This looks like technical debt that I will pay for but it is a quick fix
    if (section_object.rendered) {
        throw Error("Trying to show already rendered object.")
        // return
    }

    for (let schedule of section_object.schedule) {

        if (schedule.days === "-------") 
            continue // if there's no time slot then we don't need to render it
        
        if (schedule.days.trim() === "") 
            continue // cancelled courses have no time data
        

        

        // Don't do the hard work of parsing data if we already have an Event Object
        if(schedule.FCalendar_object != undefined) {
            if (section_object.weekends) {
                FCalendar.setOption('hiddenDays', [0])
            }
            schedule.FCalendar_object_raw["backgroundColor"] = color_class
            let obj = FCalendar.addEvent(schedule.FCalendar_object_raw)
            schedule.FCalendar_object = obj
            continue
        }

        // convert M-W---- to [1, 3]
        let value = 1
        let days = []
        for (const c of schedule.days) {
            if (!(c === '-')) {
                days.push(value)
            }
            value = (value + 1) % 7
        }
        if (days.includes(6)){
            section_object.weekends = true
            FCalendar.setOption('hiddenDays', [0])
        }

        let times = schedule.time.split("-")
        let s_time = times[0].slice(0, 2) + ":" + times[0].slice(2, 4)
        let e_time = times[1].slice(0, 2) + ":" + times[1].slice(2, 4)

        let start = null
        if (schedule.start_date !== null)
            start = new Date(schedule.start_date)
        else if (courses_first_day !== null)
            start = courses_first_day

        let end = null
        if (schedule.end_date !== null)
            end = new Date(schedule.end_date)
        else if (courses_last_day !== null)
            end = new Date(courses_last_day)
        else if (start !== null) 
            end = new Date(start.getTime() + 3600000 * 24 * 7 * 12) // 14 weeks in ms
        
        if (end != null)
            end = new Date(end.getTime() + 86400000)

        //console.log(new Date(sch.start_date), sch.start_date, sch.end_date)
        
        let f = {
            id: schedule.id,
            title: `${section_object.subject} ${section_object.course_code} ${section_object.section} ${section_object.crn} ${schedule.type} ${schedule.room}`,
            description: `${section_object.subject} ${section_object.course_code} ${section_object.section} ${section_object.crn} <br> ${schedule.type} ${schedule.room}`,
            startRecur: start,
            endRecur: end, // add 24 hours to the date to show 1 day events
            daysOfWeek: days,
            startTime: s_time,
            endTime: e_time,
            backgroundColor: color_class,
            // classNames: ["calendartxt", `${section_object.id}fc`, color_class],
            resourceId: schedule.room,
            overlap: false,
            // extendedProps: {
            //     course_code: this
            // },
            source: "json"
        }

        let FCalendar_object = FCalendar.addEvent(f)

        //console.log(f)
        schedule.FCalendar_object = FCalendar_object
        schedule.FCalendar_object_raw = f
    }

    // console.log("set rendered to true")
    section_object.rendered = true
    if (section_object.weekends) {
        saturday_courses += 1
        if (saturday_courses == 1) {
            FCalendar.setOption('hiddenDays', [0])
        }
    }


    // let colorChange = sourceElementID == null ? this.id : sourceElementID

    // try {
    //     if (!document.getElementById(colorChange).hasAttribute("savename") && color_class == "blue") {
    //         document.getElementById(colorChange).classList.add(color_class)
    //     }
    // } catch (error) {
    //     // I cannot fix this right now, too much abstraction, its horrible, i need to learn react
    //     //console.log("ERROR:", error)
    // }
}


function hideFCalendar(FCalendar, section_object) {
    if (!section_object.rendered) {
        console.log(section_object)
        throw Error("Trying to hide section that is not rendered." )
    }

    for (let schedule of section_object.schedule) {
        // online sections won't have an associated FCalendar_object
        if (schedule.FCalendar_object != undefined)
            schedule.FCalendar_object.remove()
    }

    // console.log("set rendered to false")
    section_object.rendered = false
    if (section_object.weekends) {
        saturday_courses -= 1

        if (saturday_courses == 0)
            FCalendar.setOption('hiddenDays', [0, 6])
    }
    

    // let colorChange = sourceElementID == null ? this.id : sourceElementID

    // try {
    //     if (document.getElementById(colorChange) != null) {
    //         document.getElementById(colorChange).classList.remove(color_class)
    //         document.getElementById(colorChange).classList.remove("dark-gray") // TODO: workaround to fix ghosting, should fix this properly in the future
    //         //document.getElementById(this.id).style.backgroundColor = null // change the color of the courselist div back to normal
    //     }
    // } catch (error) {
    //     console.log("ERROR:", error)
    // }


    // let show_weekends = false
    // for (const id of this.Calendar.courses_oncalendar) {
    //     let c = this.Calendar.coursesMap.get(id)

    //     if (c.hasWeekend) {
    //         show_weekends = true
    //         break
    //     }
    // }
    // if (show_weekends == false && !document.getElementById("weekendCheckbox").checked) {
    //     FCalendar.setOption('hiddenDays', [0, 6])
    // }
}