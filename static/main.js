'use strict'
var c

var CONSTANTS = {
  "API_URL": "http://127.0.0.1:8000",
  "db_api_url": "http://127.0.0.1:8000/v1/export/database.db",
  "max_shown_courses": 1500,
  "dark_mode_enabled" : false,
  "max_timetables" : 100
}

document.addEventListener('DOMContentLoaded', async function () {

  // let url = new URL(window.location.href);
  // // Check if the URL contains a 'ref' parameter
  // if (url.searchParams.has('ref')) {
  //     // Remove the 'ref' parameter
  //     url.searchParams.delete('ref');
  //     // Replace the current URL with the modified one (without the 'ref' parameter)
  //     window.history.replaceState({}, document.title, url.toString());
  // }

  const db = new Database()
  c = new Calendar(db)
  //console.log("Calendar Manager:", c)

  // Fetch database.
  db.fetchDB().then(() => {

    // Load database
    c.parseFromDB()

    // set the right date for the calendar
    c.changeSemester()

    // Initialize sidebar courselist
    c.courselistUpdate()
    c.reloadCourseList()

    // test that saves are functional
    c.showSaves()

    // Tell fcalendar to refresh resources 
    c.FCalendar.refetchResources()

    // enable options when database is ready
    document.getElementById("courseSearchBar").disabled = false
    document.getElementById("schSelector").disabled = false

    const fieldsets = document.querySelectorAll('fieldset');
    fieldsets.forEach(fieldset => { fieldset.removeAttribute('disabled') })

    console.log("Calendar successfully initialized!")

    setCourseSearch(db.getRandomItem());

    for (const s of c.saveManager.saves) {
      if (s.name == "Schedule 1") {
        c.toggleAllFCalendar(false)
        c.toggleFCalendar(s.courses_ids)
        break
      }
    }
    c.calendarUpdate()

  }).catch( error => { console.error("Error while initializing: ", error) })


  function timelineLabelApplier(name) {
    let names = {
      "A": "A Building",
      "B": "B Building",
      "C": "C Building",
      "G": "Gymnasium",
      "L": "Library",
      "T": "T Building",
      "O": "Off Campus",
      "W": "WWW / Online",
      "?": "Other",
    }
    return names[name]
  }

  let FCalendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
    schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',

    // wait 5 milliseconds before rendering events
    rerenderDelay: 5,

    // resource stuff
    resourceGroupField: 'groupId',
    resourceGroupLabelContent: function (arg) { return timelineLabelApplier(arg.groupValue) },
    resources: function (fetchInfo, successCallback, failureCallback) { successCallback(c.generateResources()) },
    resourceAreaWidth: "120px",

    // show course section information when clicked
    eventClick: function (eventClickInfo) { console.log(c.showCourseInfo(eventClickInfo.event.id)) },

    // calendar stuff
    timeZone: 'America/Vancouver',
    initialView: 'timeGridWeek', // 'resourceTimelineDay'
    slotMinTime: "07:00", // classes start 7:30 and end 9:30
    slotMaxTime: "22:00",
    displayEventTime: false, // honestly not sure what this does

    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      //right: 'dayGridMonth,timeGridWeek,timeGridDay'
      right: 'resourceTimelineDay,resourceTimelineWeek dayGridMonth,timeGridWeek,timeGridDay'
    },
    
    //weekends: document.getElementById("weekendCheckbox").checked,
    //hiddenDays: [ 0 ],
    //initialDate: new Date(new Date(calendarClass.courses_first_day).getTime() + 604800000), // start on the second week of courses
    slotEventOverlap: false, // I also don't know what this does
    allDaySlot: false, // don't show the allday row on the calendar

    // fires when event is created, adds a second line of text to each event because you can't by default ._.
    eventContent: function (info) {
      let p = document.createElement('div')
      p.innerHTML = info.event.extendedProps["description"]
      p.classList.add("event")
      return { domNodes: [p] }
    },

  })
  FCalendar.eventTextColor = 'black' // doesn't work??
  FCalendar.render();

  c.FCalendar = FCalendar

  /* 
    ======= OTHER SET UP =======
  
    ============================
  */


  // save schedules before window closes
  window.addEventListener("beforeunload", function (e) {
    c.saveManager.storeSaves()
  });

  // Set up event listeners for modifying the calendar.


  function setSaturday() {
    if (document.getElementById("weekendCheckbox").checked)
      FCalendar.setOption('hiddenDays', [0])
    else 
      FCalendar.setOption('hiddenDays', [0, 6])
  }

  setSaturday()
  document.getElementById("weekendCheckbox").addEventListener("input", setSaturday)

  // show notes
  function setNotesVisibility(bool) {
    document.getElementById("courselist").classList.toggle("hidenotes", bool)
  }
  setNotesVisibility( !document.getElementById("notesCheckbox").checked )
  document.getElementById("notesCheckbox").addEventListener("input", function(event) {
    setNotesVisibility(!event.target.checked)
  })

  // Color course element on sidebar based on availability
  // color is not generated here - this is just a switch
  document.getElementById("showColors").addEventListener("input", function (event) {
    if (document.getElementById("showColors").checked) {
      for (const e of document.getElementById("courselist").children)
        e.classList.remove("gray")
    } else {
      for (const e of document.getElementById("courselist").children)
        e.classList.add("gray")
    }
  })


  // show/hide courses on calendar when they are clicked on
  document.getElementById("courselist").addEventListener("click", function (event) {
    let target = event.target

    // open info about course if title is clicked
    if (target.nodeName == "H3") {
      c.showCourseInfo(event.target.parentElement.id)
      return
    }

    // else put it on the calendar
    if (target.nodeName != "DIV")
      target = target.parentElement
    if (target.nodeName == 'DIV' && target.id == "")
      target = target.parentElement

    if (target.classList.contains("csidebar")) {
      c.toggleFCalendar(target.id)
      if (document.getElementById("conflictCheckbox").checked)
        c.courselistUpdate()
    }

  })


  // ghosting functionality
  document.getElementById("courselist").addEventListener("mouseover", function (event) {

    let target = event.target

    if (target.nodeName != "DIV")
      target = target.parentElement
    if (target.nodeName == 'DIV' && target.id == "")
      target = target.parentElement


    if (target.classList.contains("csidebar"))
      c.setGhostFCalendar(target.id)
  })

  // make sure ghosting stops when mouse leaves
  document.getElementById("courselist").addEventListener("mouseleave", function (event) {
    c.clearAllGhosts()
  })

  // automatically update course search results when searching
  let debounceTimeout;
  document.getElementById("courseSearchBar").addEventListener("input", function (event) {

    // When we have to search lots of courses, use debounce so the page doesn't lag as much
    // set high debounce when the search would return a large number of results

    let debounceTime = ((4 - event.target.value.length) * 50) + Math.sqrt(c.courses_shown.length)
    debounceTime = Math.max(debounceTime, 250)

    clearTimeout(debounceTimeout)

    debounceTimeout = setTimeout(function () {
      c.courselistUpdate();
    }, debounceTime)

  });



  // conflicting courses
  document.getElementById("conflictCheckbox").addEventListener("input", function (event) {
    if (this.checked && c.courses_shown.length > 2000) {
      if (!confirm("You have a large number of courses shown - enabling conflict checking will cause some lag. Continue?")) {
        this.checked = false;
        return
      }
      c.courselistUpdate();
    } else {
      c.courselistUpdate();
    }
  })

  // toggle all
  document.getElementById("showAllButton").addEventListener("click", function (event) {
    c.toggleAllFCalendar(true)
  })

  document.getElementById("hideAllButton").addEventListener("click", function (event) {
    c.toggleAllFCalendar(false)
  })

  document.getElementById("clearButton").addEventListener("click", function (event) {
    c.clearFCalendar(false)
  })

  document.getElementById("showCRNsButton").addEventListener("click", function (event) {
    let out = ""
    let details = ""
    for (const id of c.courses_oncalendar) {
      out += id.split("-")[2] + " "

      let c_obj = c.coursesMap.get(id)
      details += `${c_obj.crn} ${c_obj.subject} ${c_obj.course_code} ${c_obj.section} ${c_obj.title} ${c_obj.schedule[0].instructor}\n`
      // console.log(c_obj)
    }
    alert(out + "\n\n" + details)
  })

  // TODO: redo this
  // populate termSelector and event handler for changing terms
  let ts = document.getElementById("termSelector")

  ts.addEventListener("input", async function (event) {
    c.changeSemester(event.target.value)
    c.courselistUpdate()
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
  onResize()
  
  addEventListener('mousemove', (event) => { 
    if (event.buttons === 1) { onResize() } // Not ideal but I can't think of a better way to check for resize
  })
  addEventListener("mouseup", onResize)
  addEventListener("resize", onResize);

  // TODO: fix this nonsense
  document.getElementById("mode1Button").addEventListener("click", function (event) {
    document.getElementById("sidebar_mode1").classList.remove("hidden")
    document.getElementById("sidebar_mode2").classList.add("hidden")
    document.getElementById("sidebar_mode3").classList.add("hidden")

    document.getElementById("mode1Button").classList.add("buttonSelected")
    document.getElementById("mode2Button").classList.remove("buttonSelected")
    document.getElementById("mode3Button").classList.remove("buttonSelected")
  })

  document.getElementById("mode2Button").addEventListener("click", function (event) {
    document.getElementById("sidebar_mode2").classList.remove("hidden")
    document.getElementById("sidebar_mode1").classList.add("hidden")
    document.getElementById("sidebar_mode3").classList.add("hidden")

    document.getElementById("mode2Button").classList.add("buttonSelected")
    document.getElementById("mode1Button").classList.remove("buttonSelected")
    document.getElementById("mode3Button").classList.remove("buttonSelected")

    // only used when ALL SEMESTERS selected in main page
    c.changeSemester(document.getElementById("termSelector2").value)
  })
  
  document.getElementById("mode3Button").addEventListener("click", function (event) {
    document.getElementById("sidebar_mode3").classList.remove("hidden")
    document.getElementById("sidebar_mode1").classList.add("hidden")
    document.getElementById("sidebar_mode2").classList.add("hidden")

    document.getElementById("mode3Button").classList.add("buttonSelected")
    document.getElementById("mode1Button").classList.remove("buttonSelected")
    document.getElementById("mode2Button").classList.remove("buttonSelected")

    c.showSaves()
    //document.getElementById("saveNameInput").focus()

    // schedulemanager(null)
  })

  // 4 SAVE SLOTS AND THE SAVE STUFF

  document.getElementById("sch1Button").addEventListener("click", function (event) {
    schedulemanager("sch1Button", "Schedule 1")
  })

  document.getElementById("sch2Button").addEventListener("click", function (event) {
    schedulemanager("sch2Button", "Schedule 2")
  })

  document.getElementById("sch3Button").addEventListener("click", function (event) {
    schedulemanager("sch3Button", "Schedule 3")
  })

  document.getElementById("sch4Button").addEventListener("click", function (event) {
    schedulemanager("sch4Button", "Schedule 4")
  })

  function schedulemanager(schButtonElement, schedule_name) {
    if (document.getElementById("sch1Button").classList.contains("buttonSelected"))
      createSched("Schedule 1")
    if (document.getElementById("sch2Button").classList.contains("buttonSelected"))
      createSched("Schedule 2")
    if (document.getElementById("sch3Button").classList.contains("buttonSelected"))
      createSched("Schedule 3")
    if (document.getElementById("sch4Button").classList.contains("buttonSelected"))
      createSched("Schedule 4")

    document.getElementById("sch1Button").classList.remove("buttonSelected")
    document.getElementById("sch2Button").classList.remove("buttonSelected")
    document.getElementById("sch3Button").classList.remove("buttonSelected")
    document.getElementById("sch4Button").classList.remove("buttonSelected")
    
    c.current_save = schedule_name

    if (schButtonElement != null) {
      document.getElementById(schButtonElement).classList.add("buttonSelected")

      c.toggleAllFCalendar(false)

      for (const s of c.saveManager.saves) {
        if (s.name == schedule_name) {
          c.toggleFCalendar(s.courses_ids)
          break
        }
      }

      c.calendarUpdate()
    }
  }



  // generate time tables
  const inputFields = document.querySelectorAll('#timetableGeneratorSearch input[type="text"]');
  function gti() {
    c.getTimetableInput()
  }

  inputFields.forEach(function (inputField) {
    // BAD causes lag when high amt of courses found
    //inputField.addEventListener('input', gti);
  });

  document.getElementById("generateTimetableButton").addEventListener("click", function (event) {
    c.changeSemester(document.getElementById("termSelector2").value)
    c.getTimetableInput()
  })

  // show courses for time tables
  // definitely can be improved
  document.getElementById("timetablecourselist").addEventListener("mouseover", function (event) {

    let target = event.target

    if (target.nodeName != "DIV")
      target = target.parentElement
    if (target.nodeName == 'DIV' && target.id == "")
      target = target.parentElement


    if (target.classList.contains("csidebar")) {
      c.setGhostFCalendar(target.id)

      if (target.id != c.timetableghost && c.timetableghost != null) {
        //document.getElementById(c.timetableghost).classList.remove("dark-gray")
      }
      c.timetableghost = target.id
    }

  })

  // make sure ghosting stops when mouse leaves
  document.getElementById("timetablecourselist").addEventListener("mouseleave", function (event) {
    c.clearAllGhosts()
  })


  // show/hide courses on calendar when they are clicked on
  document.getElementById("timetablecourselist").addEventListener("click", function (event) {
    let target = event.target

    // open info about course if title is clicked
    if (target.nodeName == "H3") {
      c.showCourseInfo(event.target.parentElement.id)
      return
    }

    // else put it on the calendar
    if (target.nodeName != "DIV")
      target = target.parentElement
    if (target.nodeName == 'DIV' && target.id == "")
      target = target.parentElement

    if (target.classList.contains("csidebar")) {
      c.toggleFCalendar(target.id)

      if (target.classList.contains("blue"))
        target.classList.remove("blue")
      else
        target.classList.add("blue")
    }

  })

  function convertCourseString(inputString) {
    const courses = inputString.split(/\s+/).filter(course => course.trim() !== "");
    const courseCount = courses.reduce((count, course) => {
        count[course] = (count[course] || 0) + 1;
        return count;
    }, {});

    return Object.entries(courseCount)
        .map(([course, count]) => `${course}${count > 1 ? `(${count})` : ""}`)
        .join(", ");
  }


  const saveButton = document.getElementById('betterSaveButton');
  saveButton.addEventListener('click', function(event) {

    let default_text = ""
    if (c.courses_oncalendar.length > 500) {
      default_text = `${c.courses_oncalendar.length} courses.`

    } else if (c.courses_oncalendar.length > 0) {
      for (const cID of c.courses_oncalendar) {
        const course = c.coursesMap.get(cID)
        default_text += course.subject + course.course_code + " "
      }
      default_text = convertCourseString(default_text)
    } 

    const name = prompt("Schedule name:", default_text)

    if (name === null) {
      // saveButton.value = "❌💾."
      // setTimeout(function() {saveButton.value = "Save"}, 2000)
      return
    }

    if (name == "") {
      alert("You must enter a name.")
      return
    }

    createSched(name)

    // saveButton.value = "Saved!"
    // setTimeout(function() {saveButton.value = "Save"}, 5000)

    //const courses = save.courses_ids.length > 0 ? save.courses_ids.split("_").length : 0
    //const s = courses == 1 ? "" : "s"
    //alert(`Schedule ${name} created with ${courses} course${s}.`)
  })

  // Create and save a new schedule
  function createSched(name) {

    if (name === undefined)
      name = document.getElementById("saveNameInput").value

    //const result = document.getElementById("saveResultText")

    if (name == "") {
      result.textContent = "You must enter a name."
      return
    }

    let year, term

    let yearterm = document.getElementById("termSelector").value
    if (yearterm == "ALL") {
      year = "All"
      term = "Semesters"
    } else {
      year = parseInt(yearterm.split("-")[0])
      term = parseInt(yearterm.split("-")[1])
    }

    const save = c.saveManager.editCreateSave(name, year, term, c.courses_oncalendar.join("_"))

    c.showSaves()
    //result.textContent = "Success."
    //document.getElementById("saveNameInput").value = ""
    return save
  }

  /*
  document.getElementById("saveScheduleButton").addEventListener("click", createSched)
  document.getElementById("saveNameInput").addEventListener("keyup", function (event) {
    if (event.key === "Enter")
      createSched()
  })
  */

  // Dark & Light mode
  const useDark = window.matchMedia("(prefers-color-scheme: dark)");

  function toggleDarkMode(state) {
    if (!CONSTANTS.dark_mode_enabled) 
      return

    document.documentElement.classList.toggle("dark-mode", state)
    document.getElementById("footer").classList.toggle("dark-mode", state)

    const button = document.getElementById("colorModeButton");
    if (state) {
      button.value = "☀️";
    } else {
      button.value = "🌒";
    }
  }

  toggleDarkMode(useDark.matches);

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

  function setCourseSearch(promptText) {
    const placeholderText = `Try: ${promptText}`; // Combine provided text with random prompt

    const courseSearchBar = document.getElementById("courseSearchBar");
    if (courseSearchBar) {
        courseSearchBar.setAttribute("placeholder", placeholderText);
    } else {
        console.error("Element with id 'courseSearchBar' not found.");
    }
}
})
