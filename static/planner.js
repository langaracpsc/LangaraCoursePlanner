'use strict'

// GLOBALS
var saturday_courses = 0
var sections = []
var FCalendar
var ghost_section = null
var ghost_section_sidebar = null

// const API_URL = "http://127.0.0.1:8000"
const API_URL = "coursesapi.langaracs.ca"

for (let course of courses) {

    if (course.sections == null) {
        continue
    }

    for (let s of course.sections) {
        s.rendered = false // whether the section is visible on the calendar
        s.selected = false // whether the section is selected
        s.ghost = false // whether the section is ghosted (ie in preview mode)
        s.weekends = false // whether the course has weekend or not
        s.parent = course
        sections.push(s)
    }
}


FCalendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
    schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',

    // wait 5 milliseconds before rendering events
    rerenderDelay: 5,

    // resource stuff
    resourceGroupField: 'groupId',
    resourceGroupLabelContent: function (arg) { return timelineLabelApplier(arg.groupValue) },
    // resources: function (fetchInfo, successCallback, failureCallback) { successCallback(c.generateResources()) },
    resourceAreaWidth: "120px",

    // show course section information when clicked
    eventClick: function (eventClickInfo) { 
        let tags = eventClickInfo.event.id.split("-")

        console.log(tags)
    },

    // calendar stuff
    timeZone: 'America/Vancouver',
    initialView: 'timeGridWeek', // 'resourceTimelineDay'
    slotMinTime: "07:00", // classes start 7:30 and end 9:30
    slotMaxTime: "22:00",
    displayEventTime: false, // honestly not sure what this does

    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    //   right: 'resourceTimelineDay,resourceTimelineWeek dayGridMonth,timeGridWeek,timeGridDay'
    },
    
    //weekends: document.getElementById("weekendCheckbox").checked,
    hiddenDays: [ 0, 6 ],
    //initialDate: new Date(new Date(calendarClass.courses_first_day).getTime() + 604800000), // start on the second week of courses
    slotEventOverlap: false, // I also don't know what this does
    allDaySlot: false, // don't show the allday row on the calendar

    // fires when event is created, adds a second line of text to each event because you can't by default ._.
    // also makes it an <a>
    eventContent: function (info) {
      let p = document.createElement('div')

      let a = document.createElement('a')
      let s = document.createElement('span')
      
      let tags = info.event.extendedProps["description"].split(" ")

      a.innerHTML = tags[0] + " " + tags[1]
      a.href=`/courses/${tags[0]}/${tags[1]}`
      a.target = "_blank"
      
      tags.shift()
      tags.shift()

      s.innerHTML = "&nbsp;" + tags.join(" ")

      p.classList.add("event")
      p.appendChild(a)
      p.appendChild(s)

      return { domNodes: [p] }
    },

})

document.addEventListener('DOMContentLoaded', function() {
    FCalendar.render();
    onResize()
})


// async function fetchDB() {
//     const initSqlJs = window.initSqlJs;

//     const sqlPromise = await initSqlJs({
//         locateFile: file => `libraries/sql/sql.wasm`
//     });

//     const DB_API = "http://127.0.0.1:8000/v1/export/database.db"

//     try {
//         const dataPromise = fetch(DB_API, { cache: "no-cache" }).then(res => {
//             if (!res.ok) {
//                 throw new Error(`Failed to fetch data from ${DB_API}`);
//             }
//             return res.arrayBuffer();
//         });

//         const [SQL, buf] = await Promise.all([sqlPromise, dataPromise]);
//         const db = new SQL.Database(new Uint8Array(buf));

//         database = db
//         console.log(database)

//     } catch (error) {
//         throw error
//     }
// }

// fetchDB()
// console.log(database)

function getSectionVariable(section_id) {
    for (let s of sections) {
        if (s.id == section_id)
            return s
    }
    throw Error(`Didn't find ${section_id}`)
}



function getSidebarEventTarget(event, skiptitle=true) {
    let target = event.target

    // do nothing if we click the link on h3
    // unless we want to skip because we want to ghost on hover
    // TODO: flip this conditional
    if (target.nodeName == "A") {
        if (!skiptitle)
            return null
        else
        target = target.parentElement
    }

    // do nothing if we click on the gap between courses
    if (target.nodeName == "DIV" && target.id == "courselist") {
        return null
    }

    // else put it on the calendar
    if (target.nodeName != "DIV")
        target = target.parentElement
    if (target.nodeName == 'DIV' && target.id == "")
      target = target.parentElement

    if (!(target.classList.contains("section"))) {
        console.log(`Original and final target:`)
        console.log(event.target)
        console.log(target)
        throw Error("Unexpected element clicked in sidebar.")
    }

    return target
}

document.getElementById("showAllButton").addEventListener("click", function (event) {
    let course_list = document.getElementById("courselist")
    for (let s of course_list.children) {
        if (s.classList.contains("hidden"))
            continue
        let section_object = getSectionVariable(s.id)
        if (!section_object.rendered)
            showSection(section_object, s)
    }
})

document.getElementById("clearButton").addEventListener("click", function (event) {
    let course_list = document.getElementById("courselist")
    for (let s of course_list.children) {
        let section_object = getSectionVariable(s.id)
        if(section_object.selected)
            hideSection(section_object, s)
    }
})

document.getElementById("hideAllButton").addEventListener("click", function (event) {
    let course_list = document.getElementById("courselist")
    for (let s of course_list.children) {
        if (s.classList.contains("hidden"))
            continue
        let section_object = getSectionVariable(s.id)
        if(section_object.selected)
            hideSection(section_object, s)
    }
})

document.getElementById("courselist").addEventListener("click", function (event) {
    let target = getSidebarEventTarget(event)
    if (target == null)
        return

    let section_object = getSectionVariable(target.id)

    if (!section_object.selected) {
        showSection(section_object, target)
    } else {
        hideSection(section_object, target, true)
    }
    // TODO: if we check for conflicts
    // c.courselistUpdate()
})

function showSection(section_object, sidebar_html) {
    if (section_object.ghost)
        unghostSection(section_object)
    showFCalendar(FCalendar, section_object)
    if (sidebar_html != null)
        sidebar_html.classList.add("blue")
    section_object.selected = true
}

function hideSection(section_object, sidebar_html, reghost_section=false, saturday_courses) {
    hideFCalendar(FCalendar, section_object)
    sidebar_html.classList.remove("blue")
    section_object.selected = false
    // we can take the shortcut of reghosting the course since mouse will always be over
    // only when we're hiding one course at once/following the cursor
    if (reghost_section)
        ghostSection(section_object, sidebar_html)
}

function ghostSection(section_object, sidebar_html) {
    if (section_object.ghost)
        throw Error("Trying to ghost object that is already ghosted.")

    
    if (ghost_section) {
        // this happens if you go too fast and the event listeners can't keep up
        // console.warn("Unghosted previous ghost before creating new ghost.")
        unghostSection(ghost_section)
    }
    
    ghost_section = section_object
    showFCalendar(FCalendar, ghost_section, "#b7b2b2")
    ghost_section.ghost = true
    ghost_section_sidebar = sidebar_html
    // ghost_section_sidebar.classList.add("dark-gray")
}

function unghostSection(section_object) {
    if (!section_object.ghost)
        throw Error("Trying to unghost object that is not a ghost.")

    hideFCalendar(FCalendar, ghost_section)
    ghost_section.ghost = false
    ghost_section_sidebar.classList.remove("dark-gray")
    ghost_section = null
    ghost_section_sidebar = null
}

document.getElementById("courselist").addEventListener("mousemove", function (event) {
    let target = getSidebarEventTarget(event, false)
    if (target == null)
        return

    let section_object = getSectionVariable(target.id)

    // don't ghost something that's already ghosted
    if (section_object == ghost_section)
        return

    // don't ghost a section that is selected
    if (section_object.selected)
        return

    // hide the previous ghost, if there is a previous ghost
    if (ghost_section != null) {
        unghostSection(ghost_section)
    }

    if (section_object.shown)
        return

    ghostSection(section_object, target)
})

// make sure ghosting stops when mouse leaves
document.getElementById("courselist").addEventListener("mouseleave", function (event) {
    if (!ghost_section)
        return

    hideFCalendar(FCalendar, ghost_section)
    ghost_section.ghost = false
    // ghost_section_sidebar.classList.remove("dark-gray")
    ghost_section = null
    ghost_section_sidebar = null
})


// search bar
let debounceTimeout;
document.getElementById("courseSearchBar").addEventListener("input", function (event) {

    // When we have to search lots of courses, use debounce so the page doesn't lag as much
    // set high debounce when the search would return a large number of results

    let debounceTime = ((4 - event.target.value.length) * 50)
    debounceTime = Math.max(debounceTime, 100)

    clearTimeout(debounceTimeout)

    debounceTimeout = setTimeout(function () {
        sendSearchQuery()
    }, debounceTime)

});

async function sendSearchQuery() {
    let query = document.getElementById("courseSearchBar").value

    const response = await fetch(`${API_URL}/v1/search/sections?query=${query}&year=${year}&term=${term}`)
    let search_results = await response.json()

    document.getElementById("searchResults").textContent = `Found ${search_results.sections.length} sections.`
    console.log(search_results)
    filterSidebarCourses(search_results.sections)
}
sendSearchQuery()

function filterSidebarCourses(sections_to_be_shown) {
    let course_list = document.getElementById("courselist")

    for (let s of course_list.children) {
        // let section_object = getSectionVariable(s.id)

        if(sections_to_be_shown.includes(s.id)) {
            s.classList.remove("hidden")
        } else {
            s.classList.add("hidden")
            // hide course
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const termSelector = document.getElementById("termSelector");
    const yearTerm = `SMTR-${year}-${term}`;
    
    for (const option of termSelector.options) {
        if (option.value === yearTerm) {
            option.selected = true;
            break;
        }
    }
});

document.getElementById("termSelector").addEventListener("input", async function (event) {
    let new_yearterm = event.target.value
    new_yearterm = new_yearterm.replace("SMTR-", "").replace("-", "")
    console.log(new_yearterm)
    window.location.href = `?term=${new_yearterm}`

})

// Implement resizeability for the sidebar
// I would love to do this in css but it refuses to cooperate
function onResize(event) {
    const sidebarWidth = document.getElementById("sidebar").offsetWidth
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)

    // Don't make the calendar too small on mobile, even if it overflows
    const finalWidth = Math.max(400, vw - sidebarWidth - 20)

    const newwidth = `${finalWidth}px`

    if (document.getElementById("calendarwrapper").style.width == newwidth)
      return 

    document.getElementById("calendarwrapper").style.width = newwidth

    FCalendar.updateSize()
}

document.addEventListener("DOMContentLoaded", onResize());

addEventListener('mousemove', (event) => { 
if (event.buttons === 1) { onResize() } // Not ideal but I can't think of a better way to check for resize
})
addEventListener("mouseup", onResize)
addEventListener("resize", onResize);


// Dark & Light mode
const useDark = window.matchMedia("(prefers-color-scheme: dark)");

function toggleDarkMode(state) {
//   if (!CONSTANTS.dark_mode_enabled) 
//     return

  document.documentElement.classList.toggle("dark-mode", state)
  document.getElementById("footer").classList.toggle("dark-mode", state)

  const button = document.getElementById("colorModeButton");
  if (state) {
    button.value = "☀️";
  } else {
    button.value = "🌒";
  }
}

// toggleDarkMode(useDark.matches);

useDark.addEventListener("change", (evt) => toggleDarkMode(evt.matches));

document.getElementById("colorModeButton").addEventListener("click", () => {
  document.documentElement.classList.toggle("dark-mode");
  document.getElementById("footer").classList.toggle("dark-mode")

  const root = document.documentElement;
  const button = document.getElementById("colorModeButton");
  
  if (root.classList.contains("dark-mode")) {
    button.value = "☀️";
  } else {
    button.value = "🌒";
  }
});