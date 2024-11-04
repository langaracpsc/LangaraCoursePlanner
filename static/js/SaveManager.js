
class Save {
    constructor(name, year, term, courses_ids = "") {
        this.name = name
        this.year = year
        this.term = term
        this.lastedited = new Date()

        this.courses_ids = courses_ids

        console.assert(typeof this.courses_ids == 'string')
    }

    loadData(data) {
        this.name = data.name
        this.year = data.year
        this.term = data.term
        this.lastedited = new Date(data.lastedited)
        this.courses_ids = data.courses_ids

        console.assert(typeof this.courses_ids == 'string')
    }
        

    generateSidebarHTML(map) {
        let html = `<h3><span>${this.name}</span><span>(${this.year}${this.term})</span></h3>`

        const formattedDate = `${this.lastedited.toDateString()} ${this.lastedited.toLocaleTimeString()}`;
        html += `<p>Last edited: ${formattedDate}</p>`

        if (this.courses_ids == "") {
            html += "<p>No courses.</p>"
        } else {
            let split = this.courses_ids.split("_")

            let courses = split.map(id => map.get(id))
            console.log(c)
            let print2 = courses.map(c => `${c.subject} ${c.course_code}`)

            const max = 20

            html += `<p>${print2.slice(0, max).join(", ")}</p>`

            if (print2.length > max)
                html += `And ${print2.length - 10} more...`
        }

        let htmlwrapper = document.createElement('div');
        htmlwrapper.innerHTML = html

        let del = document.createElement('img');
        del.src = "assets/bin.png"

        let div = document.createElement('div');
        div.setAttribute("savename", this.name)
        div.appendChild(htmlwrapper)
        div.appendChild(del)

        div.id = this.courses_ids
        div.className = `csidebar savediv gray`

        let t = this
        htmlwrapper.firstChild.addEventListener("click", function(event) {
                    
            function updateHeader(inputField) {
                const newText = inputField.value;
                const newSpan = document.createElement('span');
                newSpan.textContent = newText;

                inputField.replaceWith(newSpan);

                t.name = newText
            }

            const text = this.querySelector('span:first-child').innerText;
            const inputField = document.createElement('input');
            inputField.type = 'text';
            inputField.value = text;
            inputField.select()

            // Replace the header with the input field
            const editablePart = this.querySelector('span:first-child');
            editablePart.replaceWith(inputField);

            inputField.focus();

            inputField.addEventListener('blur', () => {
                updateHeader(inputField)
            });

            inputField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    updateHeader(inputField)
                }
            });
        })


        return div
    }
}


class SaveManager {
    constructor() {
        this.saves = []
    }

    createSave(name, year, term, courses_ids) {
        const existingSave = this.saves.find(save => save.name === name);

        if (!existingSave) {
            const save = new Save(name, year, term, courses_ids)
            if (save.name == "autosave")
                this.saves.unshift(save)
            else
                this.saves.push(save)
        } else
            console.error("save already exists")
    }

    editSave(name, year, term, courses_ids) {
        const existingSave = this.saves.find(save => save.name === name);
        console.assert(existingSave, "Save does not exist")

        existingSave.year = year;
        existingSave.term = term;
        existingSave.lastedited = new Date()
        existingSave.courses_ids = courses_ids
    }

    editCreateSave(name, year, term, courses_ids) {
        const existingSave = this.saves.find(save => save.name === name)
        if (existingSave)
            this.editSave(name, year, term, courses_ids)
        else
            this.createSave(name, year, term, courses_ids)

        return this.getSave(name)
    }

    deleteSave(name) {
        const index = this.saves.findIndex(save => save.name === name)
        this.saves.splice(index, 1)
    }

    getSave(name) {
        return this.saves.find(save => save.name === name)
    }

    storeSaves() {
        localStorage.setItem('saves', JSON.stringify(this.saves));
    }

    loadSaves() {
        const load = localStorage.getItem('saves')

        if (load === null || load == "[null]" || load == "[]") {
            this.createSave("autosave", null, null)
            console.log(`No saves found.`)
            return
        }

        const json = JSON.parse(load)
        console.assert(Array.isArray(json), "Stored data is not valid.")

        this.saves = []
        for (const s of json) {
            let save = new Save()
            save.loadData(s)
            this.saves.push(save)
        }

        let s = "s"
        if (this.saves.length == 1) {
            s = ""
        }
        console.log(`${this.saves.length} save${s} restored.`, this.saves)
    }

    info() {
        console.log(`${this.saves.length} saves.`)
        console.log(this.saves)
    }

    clearData() {
        this.saves = []
        localStorage.removeItem("saves")
    }

}