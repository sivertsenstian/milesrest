import { LTD, LTOB, LTTB } from "downsample";
import { XYDataPoint } from "downsample/dist/types";
const sqlite3 = require('sqlite3').verbose();

// INIT
const name = "./db.sqlite";
const connect = () => new sqlite3.Database(name);

export const init = () => {
    // CREATE TABLE
    let     db = connect();
    db.serialize(function() {
        db.run("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, boxId INTEGER, name TEXT NOT NULL, UNIQUE(boxId, name))");
        db.run("CREATE TABLE IF NOT EXISTS sensors(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, unit TEXT NOT NULL)");
        db.run("CREATE TABLE IF NOT EXISTS measurements(id INTEGER PRIMARY KEY AUTOINCREMENT, boxId INT NOT NULL, value NUM, sensorId INT NOT NULL, timestamp TEXT NOT NULL, UNIQUE(boxId, sensorId, timestamp))");
    });
    const users = [{
        name: "Stian",
        boxId: 1000
    },
                   {
        name: "Mads",
        boxId: 2000
    }],
    sensors = [{
        name: "Temperature",
        unit: "℃"
    },
               {
        name: "Humidity",
        unit: "%"
    }];

    const addUser = `INSERT OR IGNORE INTO users(boxId, name) VALUES (?, ?)`,
    addSensor = `INSERT OR IGNORE INTO sensors(name, unit) VALUES(?, ?)`;
    users.forEach(u => {
        db.run(addUser, [u.boxId, u.name]);
    })
    sensors.forEach(s => {
        db.run(addSensor, [s.name, s.unit]);
    })

    db.close();
}

export const add = async (boxId: number, sensor: number, value: number) => {
    let db = connect(),
    sql = "INSERT OR IGNORE INTO measurements(boxId, sensorId, value, timestamp) VALUES (?, ?, ?, ?)",
    params = [boxId, sensor, value, Date.now()];

    const result = await new Promise((resolve, reject) => {
        db.run(sql, params, function(this: any, err: any){
            if (err) {
                reject(err)
            }
            resolve(this.changes);
        });
        
    })
    db.close();
    return result;
}

export const all = async (boxId : number, sensor: number, values: number, limit: number) => {
    let db = connect(),
    sql = "SELECT timestamp as x, value as y FROM measurements WHERE boxId = ? AND sensorId = ? ORDER BY timestamp desc LIMIT ?",
    params = [boxId, sensor, limit];
    const result = await new Promise((resolve, reject) => {
        db.all(sql, params, (err: any, rows: any[]) => {
            if (err) {
                reject(err);
            }
            const downSampledData  = LTOB(rows, values);
            resolve(downSampledData);
        });
    });
    db.close();
    return result;
}

export const latest = async (boxId : number, sensor: number) => {
    let db = connect(),
    sql = "SELECT timestamp as x, value as y FROM measurements WHERE boxId = ? AND sensorId = ? ORDER BY timestamp desc LIMIT 1",
    params = [boxId, sensor];
    const result = await new Promise((resolve, reject) => {
        db.all(sql, params, (err: any, rows: any[]) => {
            if (err) {
                reject(err);
            }
            resolve(rows[0]);
        });
    });
    db.close();
    return result;
}

export const boxes = async () => {
    let db = connect(),
    sql = "SELECT * FROM users";
    const result = await new Promise((resolve, reject) => {
        db.all(sql, [], (err: any, rows: any[]) => {
            if (err) {
                reject(err);
            }
            resolve(rows);
        });
    });
    db.close();
    return result;
}

export const sensors = async () => {
    let db = connect(),
    sql = "SELECT * FROM sensors";
    const result = await new Promise((resolve, reject) => {
        db.all(sql, [], (err: any, rows: any[]) => {
            if (err) {
                reject(err);
            }
            resolve(rows);
        });
    });
    db.close();
    return result;
}
