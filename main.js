'use strict'
var c

document.addEventListener('DOMContentLoaded', async function() {


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
    if (c.checkRestoreAvailable() && confirm("Found previous calendar data - would you like to restore it?"))
      c.restoreShownCourses()

    // Generate resources 
    c.FCalendar.refetchResources()

    }).catch(
      error => {console.error("Error while initializing calendar: ", error)
    })

  c = new Calendar(db)
  console.log(c)

  
  function timelineLabelApplier(name) {
    let names = {
      "A" : "A Building",
      "B" : "B Building",
      "C" : "C Building",
      "G" : "Gymnasium",
      "L" : "Library",
      "T" : "T Building",
      "O" : "Off Campus",
      "W" : "WWW / Online",
      "?" : "Other",
    } 
    return names[name]
  }


  var calendarElement = document.getElementById('calendar');

  var FCalendar = new FullCalendar.Calendar(calendarElement, {
    schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
    rerenderDelay: 10,

    // resource stuff
    resourceGroupField: 'groupId',
    resourceGroupLabelContent: function(arg) {return timelineLabelApplier(arg.groupValue)},
    resources: function(fetchInfo, successCallback, failureCallback) {successCallback(c.generateResources())},
    resourceAreaWidth: "120px",
    // show class info when clicked
    //eventClick: function(eventClickInfo) {console.log(calendarClass.showCourseInfo(eventClickInfo.event.id))},

    // calendar stuff
    timeZone: 'America/Vancouver',
    initialView: 'timeGridWeek', // 'resourceTimelineDay'
    slotMinTime:"07:00", // classes start 7:30 and end 9:30
    slotMaxTime:"22:00",
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
    slotEventOverlap:false,
    allDaySlot: false, // don't show the allday row on the calendar
    
    // fires when event is created, adds a second line of text to event because you can't by default ._.
    eventContent: function(info) {
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

  window.addEventListener("beforeunload", function(e){
    c.storeShownCourses()
 });



  // Set up event listeners for modifying the calendar.

  document.getElementById("weekendCheckbox").addEventListener("input", function (event) {
    setSaturday(event.target.checked)
  })

  function setSaturday(show) {
    if (show) {
      FCalendar.setOption('hiddenDays', [ 0 ])
    } else {
      FCalendar.setOption('hiddenDays', [ 0, 6 ])
    }
  }

  setSaturday(document.getElementById("weekendCheckbox").checked)
  


  // Color course element based on availability
  // bit of a misnomer of a comment
  document.getElementById("showColors").addEventListener("input", function (event) {
    if (document.getElementById("showColors").checked) {
      for (const e of document.getElementById("courselist").children )
        e.classList.remove("gray")
    } else {
      for (const e of document.getElementById("courselist").children )
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
    
    if (target.classList.contains("courselistcourse")) {
      c.toggleFCalendar(target.id)
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
      
    
    if (target.classList.contains("courselistcourse"))
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
        debounceTimeout = setTimeout(function() {
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
      if (!confirm("You have a large number of courses shown; enabling this option will cause some lag. Continue?")) {
        this.checked = false;
        return
      }
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

})