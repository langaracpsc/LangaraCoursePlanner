'use strict'
var c

var CONSTANTS = {
  "db_api_url": "https://api2.langaracs.tech/courseDB.db",
  "max_shown_courses": 1500
}

document.addEventListener('DOMContentLoaded', async function () {


  const db = new Database()

  db.fetchDB().then(() => {

    // Load Database
    c.parseFromDB()

    // set Calendar Semester
    c.changeSemester()

    // Initialize courselist
    c.courselistUpdate()
    c.reloadCourseList()

    // restore courses from localstorage
    c.showSaves()

    // Generate resources 
    c.FCalendar.refetchResources()

    document.getElementById("courseSearchBar").disabled = false
    const fieldsets = document.querySelectorAll('fieldset');
    fieldsets.forEach(fieldset => {
      fieldset.removeAttribute('disabled');
    });

  }).catch(
    error => {
      console.error("Error while initializing: ", error)
    })

  c = new Calendar(db)
  console.log(c)


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


  var calendarElement = document.getElementById('calendar');

  var FCalendar = new FullCalendar.Calendar(calendarElement, {
    schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
    rerenderDelay: 10,

    // resource stuff
    resourceGroupField: 'groupId',
    resourceGroupLabelContent: function (arg) { return timelineLabelApplier(arg.groupValue) },
    resources: function (fetchInfo, successCallback, failureCallback) { successCallback(c.generateResources()) },
    resourceAreaWidth: "120px",
    // show class info when clicked
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
    slotEventOverlap: false,
    allDaySlot: false, // don't show the allday row on the calendar

    // fires when event is created, adds a second line of text to event because you can't by default ._.
    eventContent: function (info) {
      let p = document.createElement('p')
      p.innerHTML = info.event.extendedProps["description"]
      return { domNodes: [p] }
    },

  })
  FCalendar.eventTextColor = 'black' // doesn't work??


  c.FCalendar = FCalendar

  // Render calendar
  FCalendar.render();

  // Render courses
  //c.courselistUpdate()

  window.addEventListener("beforeunload", function (e) {
    c.saveManager.storeSaves()
  });



  // Set up event listeners for modifying the calendar.

  document.getElementById("weekendCheckbox").addEventListener("input", function (event) {
    setSaturday(event.target.checked)
  })

  function setSaturday(show) {
    if (show) {
      FCalendar.setOption('hiddenDays', [0])
    } else {
      FCalendar.setOption('hiddenDays', [0, 6])
    }
  }

  setSaturday(document.getElementById("weekendCheckbox").checked)



  // Color course element based on availability
  // bit of a misnomer of a comment
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
    c.setGhostFCalendar(null)
  })

  // automatically update results when searching
  let debounceTimeout;
  document.getElementById("courseSearchBar").addEventListener("input", function (event) {

    // When we have to search lots of courses, use debounce so the page doesn't lag as much
    if (c.courses_shown.length > 2000) {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(function () {
        c.courselistUpdate();
      }, 250); // 250 milliseconds (0.25 seconds) debounce delay
    } else {
      // Perform immediate update if the condition is not met
      c.courselistUpdate();
    }
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

  // TODO: redo this
  // populate termSelector and event handler for changing terms
  let ts = document.getElementById("termSelector")

  ts.addEventListener("input", async function (event) {
    c.changeSemester()
    c.courselistUpdate()
  })


  function onResize(event) {
    const sidebarWidth = document.getElementById("sidebar").offsetWidth
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)

    const newwidth = `${vw - sidebarWidth - 20}px`

    document.getElementById("calendarwrapper").style.width = newwidth

    FCalendar.updateSize()

  }
  onResize()
  addEventListener("mouseup", onResize);
  addEventListener("resize", onResize);


  document.getElementById("mode1Button").addEventListener("click", function (event) {
    document.getElementById("sidebar_mode1").classList.remove("hidden")

    document.getElementById("sidebar_mode2").classList.add("hidden")
    document.getElementById("sidebar_mode3").classList.add("hidden")
  })

  document.getElementById("mode2Button").addEventListener("click", function (event) {
    document.getElementById("sidebar_mode2").classList.remove("hidden")

    document.getElementById("sidebar_mode1").classList.add("hidden")
    document.getElementById("sidebar_mode3").classList.add("hidden")
  })

  document.getElementById("mode3Button").addEventListener("click", function (event) {
    document.getElementById("sidebar_mode3").classList.remove("hidden")

    document.getElementById("sidebar_mode1").classList.add("hidden")
    document.getElementById("sidebar_mode2").classList.add("hidden")

    c.showSaves()
    document.getElementById("saveNameInput").focus()
  })

  document.getElementById("generateTimetableButton").addEventListener("click", function (event) {
    c.getTimetableInput()
  })


  document.getElementById("timetablecourselist").addEventListener("mouseover", function (event) {

    let target = event.target

    if (target.nodeName != "DIV")
      target = target.parentElement
    if (target.nodeName == 'DIV' && target.id == "")
      target = target.parentElement


    if (target.classList.contains("csidebar")) {
      c.setGhostFCalendar(target.id)

      if (target.id != c.timetableghost && c.timetableghost != null) {
        document.getElementById(c.timetableghost).classList.remove("dark-gray")
      }
      c.timetableghost = target.id
    }

  })

  // make sure ghosting stops when mouse leaves
  document.getElementById("timetablecourselist").addEventListener("mouseleave", function (event) {
    c.setGhostFCalendar(null)
    document.getElementById(c.timetableghost).classList.remove("dark-gray") // MASSIVE VIOLATION OF OOP
    //console.log("removed gray from", c.timetableghost) 
    c.timetableghost = null
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

  function createSched() {

    const name = document.getElementById("saveNameInput").value
    const result = document.getElementById("saveResultText")

    if (name == "") {
      result.textContent = "You must enter a name."
      return
    }

    let yearterm = document.getElementById("termSelector").value
    if (yearterm == "ALL") {
      yearterm = "ALL-SEMESTERS"
    }
    const year = parseInt(yearterm.split("-")[0])
    const term = parseInt(yearterm.split("-")[1])

    c.saveManager.editCreateSave(name, year, term, c.courses_oncalendar.join("_"))

    c.showSaves()
    result.textContent = "Success."
    document.getElementById("saveNameInput").value = ""
  }

  document.getElementById("saveScheduleButton").addEventListener("click", createSched)
  document.getElementById("saveNameInput").addEventListener("keyup", function (event) {
    if (event.key === "Enter")
      createSched()
  })
})