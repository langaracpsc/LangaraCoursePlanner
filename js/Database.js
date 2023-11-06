'use strict'


class Database {
    constructor() {
        this.db = null
    }

    async fetchDB() {
        const initSqlJs = window.initSqlJs;

        const sqlPromise = await initSqlJs({
            locateFile: file => `libraries/sql/sql.wasm`
        });

        const DB_API = CONSTANTS["db_api_url"]

        try {
            const dataPromise = fetch(DB_API).then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch data from ${DB_API}`);
                }
                return res.arrayBuffer();
            });

            const [SQL, buf] = await Promise.all([sqlPromise, dataPromise]);
            const db = new SQL.Database(new Uint8Array(buf));

            this.db = db;

        } catch (error) {
            throw error
        }
    }

    executeQuery(sql) {
        const result = this.db.exec(sql);
        if (result.length > 0 && result[0].values.length > 0) {
            return result[0].values;
        }
        return [];
    }

    getDBInfo() {
        return `Database Statistics: ${this.getSections().length} sections and  ${this.getTransfers().length} transfer agreements.`
    }

    getCourseInfos(subject, course_code) {

        let query
        if (subject != null && course_code != null) {
            query = `SELECT * FROM CourseInfo WHERE subject='${subject}' AND course_code=${course_code} `
        } else if (subject != null) {
            query = `SELECT * FROM CourseInfo WHERE subject='${subject}'`
        } else if (course_code != null) {
            // I cannot imagine what you would use this for
            query = `SELECT * FROM CourseInfo WHERE course_code=${course_code}`
        } else {
            query = "SELECT * FROM CourseInfo"
        }

        const rows = this.executeQuery(query);
        return rows
    }

    getSections(year, term, crn, subject, course_code) {
        //year = 2024
        //term = 10

        let query = `
        SELECT Sections.*, Schedules.*
        FROM Sections
        LEFT JOIN Schedules ON Sections.year = Schedules.year
                           AND Sections.term = Schedules.term
                           AND Sections.crn = Schedules.crn
        `

        // TODO: make this cover ALL cases
        if (subject != null && course_code != null) {
            query += ` WHERE Sections.subject = '${subject}' AND Sections.course_code = ${course_code}`
        } else if (year != null && term != null && crn != null) {
            query += ` WHERE Sections.year = ${year} AND Sections.term = ${term} AND Sections.crn = ${crn}`
        } else if (year != null && term != null) {
            query += ` WHERE Sections.year = ${year} AND Sections.term = ${term}`
        } else if (year != null) {
            query += ` WHERE Sections.year = ${year}`
        }

        query += ` ORDER BY Sections.year DESC, Sections.term DESC, Sections.subject ASC, Sections.course_code ASC`

        const rows = this.executeQuery(query);

        // hhhhh
        // must efficiently extract schedule and course information and insubstantiate them into classes for fuzzy search
        let out = []

        for (let i = 0; i < rows.length; i++) {

            let init = rows[i]
            let schedule = [init.slice(17, 23 + 1)]

            let j = i + 1
            let next = rows[j]

            while (next != undefined && init[0] == next[0] && init[1] == next[1] && init[5] == next[5]) {
                schedule.push(next.slice(17, 23 + 1))
                j += 1
                next = rows[j]
            }

            const c = new Course(init.slice(0, 14), schedule)
            out.push(c)

            i = j - 1
        }

        return out
    }

    getSchedules(year, term, crn) {
        let query
        if (year == null || term == null || crn == null) {
            query = "SELECT * FROM Schedules";
        } else {
            query = `SELECT * FROM Schedules WHERE year=${year} AND term=${term} AND crn=${crn}`;
        }

        query += ` ORDER BY Schedules.type DESC`;

        const rows = this.executeQuery(query);
        return rows
    }

    getTransfers(subject = null, course_code = null) {

        let query
        if (subject == null || course_code == null) {
            query = "SELECT * FROM TransferInformation";
        } else {
            query = `SELECT * FROM TransferInformation WHERE subject='${subject}' AND course_code=${course_code}`;
        }

        const rows = this.executeQuery(query);
        return rows
    }

    getAvailableSemesters() {
        const query = `
            SELECT DISTINCT year, term
            FROM Sections
            ORDER BY year DESC, term DESC
        `;

        const rows = this.executeQuery(query);
        return rows
    }

    getSubjects() {
        const query = `
        SELECT DISTINCT subject FROM CourseInfo
        `

        const rows = this.executeQuery(query);
        return [].concat(...rows);
    }


}