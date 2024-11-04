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
        console.log(sql)
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
            query = `SELECT * FROM CourseMaxDB WHERE subject='${subject}' AND course_code=${course_code} `
        } else if (subject != null) {
            query = `SELECT * FROM CourseMaxDB WHERE subject='${subject}'`
        } else if (course_code != null) {
            // I cannot imagine what you would use this for
            query = `SELECT * FROM CourseMaxDB WHERE course_code=${course_code}`
        } else {
            query = "SELECT * FROM CourseMaxDB"
        }

        const rows = this.executeQuery(query);
        return rows
    }

    getSections(year, term, crn, subject, course_code) {
        
        if (year != null && tern != null && crn == null && subject == null && course_code==null) {
            fetch(CONSTANTS["API_URL"] + `/v1/semester/${year}/${term}/sections`)
        }
        let query = `
        SELECT SectionDB.*, ScheduleEntryDB.*
        FROM SectionDB
        LEFT JOIN ScheduleEntryDB ON SectionDB.year = ScheduleEntryDB.year
                        AND SectionDB.term = ScheduleEntryDB.term
                        AND SectionDB.crn = ScheduleEntryDB.crn
        WHERE 1 = 1
        `;

        if (subject != null && course_code != null) 
            query += ` AND SectionDB.subject = '${subject}' AND SectionDB.course_code = ${course_code}`;

        if (year != null)
            query += ` AND SectionDB.year = ${year}`;

        if (term != null)
            query += ` AND SectionDB.term = ${term}`;

        if (crn != null)
            query += ` AND SectionDB.crn = ${crn}`;

        query += ` ORDER BY SectionDB.year DESC, SectionDB.term DESC, SectionDB.subject ASC, SectionDB.course_code ASC, SectionDB.section ASC`;

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
            query = "SELECT * FROM ScheduleEntryDB";
        } else {
            query = `SELECT * FROM ScheduleEntryDB WHERE year=${year} AND term=${term} AND crn=${crn}`;
        }

        query += ` ORDER BY ScheduleEntryDB.type DESC`;

        const rows = this.executeQuery(query);
        return rows
    }

    getTransfers(subject = null, course_code = null) {
        let query
        if (subject == null || course_code == null) {
            query = "SELECT * FROM TransferDB";
        } else {
            query = `SELECT * FROM TransferDB WHERE subject='${subject}' AND course_code=${course_code}`;
        }

        const rows = this.executeQuery(query);
        return rows
    }

    getAvailableSemesters() {
        const query = `
            SELECT DISTINCT year, term
            FROM SectionDB
            ORDER BY year DESC, term DESC
        `;

        const rows = this.executeQuery(query);
        return rows
    }

    getSubjects() {
        const query = `
        SELECT DISTINCT subject FROM CourseMaxDB
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
        let query;
    
        switch(randomIndex) {
            case 0:
                query = `SELECT room FROM ScheduleEntryDB ORDER BY RANDOM() LIMIT 1`;
                break;
            case 1:
                query = `SELECT time FROM ScheduleEntryDB ORDER BY RANDOM() LIMIT 1`;
                break;
            case 2:
                query = `SELECT instructor FROM ScheduleEntryDB ORDER BY RANDOM() LIMIT 1`;
                break;
            default:
                return null;
        }
            const rows = this.executeQuery(query);
            console.log("Rows:", rows); // Debugging log
            return rows[0][0];
    }
}
