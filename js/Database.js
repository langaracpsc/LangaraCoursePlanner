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
            const dataPromise = fetch(DB_API, {cache: "reload"}).then(res => {
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

        let query = `
        SELECT Sections.*, Schedules.*
        FROM Sections
        LEFT JOIN Schedules ON Sections.year = Schedules.year
                        AND Sections.term = Schedules.term
                        AND Sections.crn = Schedules.crn
        WHERE 1 = 1
        `;

        if (subject != null && course_code != null) 
            query += ` AND Sections.subject = '${subject}' AND Sections.course_code = ${course_code}`;

        if (year != null)
            query += ` AND Sections.year = ${year}`;

        if (term != null)
            query += ` AND Sections.term = ${term}`;

        if (crn != null)
            query += ` AND Sections.crn = ${crn}`;

        query += ` ORDER BY Sections.year DESC, Sections.term DESC, Sections.subject ASC, Sections.course_code ASC, Sections.section ASC`;

        const rows = this.executeQuery(query);

        // must efficiently extract schedule and course information and insubstantiate them into classes for fuzzy search
        let out = [];
        let i = 0;

        while (i < rows.length) {
            const init = rows[i];
            const schedule = [];

            while (i < rows.length && init[0] === rows[i][0] && init[1] === rows[i][1] && init[5] === rows[i][5]) {
                schedule.push(rows[i].slice(17, 24));
                i++;
            }

            const c = new Course(init.slice(0, 14), schedule);
            out.push(c);
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

    getRandomItem() {
        if (!this.db) {
            console.error('Database is not initialized.');
            return null;
        }
    
        const randomIndex = Math.floor(Math.random() * 3); // 0, 1, or 2
        let query, columnName;
    
        switch(randomIndex) {
            case 0:
                query = `SELECT room FROM Schedules ORDER BY RANDOM() LIMIT 1`;
                columnName = 'room';
                break;
            case 1:
                query = `SELECT time FROM Schedules ORDER BY RANDOM() LIMIT 1`;
                columnName = 'time';
                break;
            case 2:
                query = `SELECT instructor FROM Schedules ORDER BY RANDOM() LIMIT 1`;
                columnName = 'instructor';
                break;
            default:
                return null;
        }
            const rows = this.executeQuery(query);
            console.log("Rows:", rows); // Debugging log
            return rows[0][0];
    }
    


}