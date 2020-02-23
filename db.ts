import { LTOB } from "downsample";
const sqlite3 = require("sqlite3").verbose();
import * as moment from "moment";
import * as security from "./security";

const DEBUG = true;

// INIT
const name = "./db.sqlite";
const connect = () => new sqlite3.Database(name);
const db = connect();

// HELPERS
const run = (
  db: any,
  sql: string,
  params: any[] = []
): Promise<{ id: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: any, err: any) {
      if (err) {
        console.log("Error running sql " + sql);
        console.log(err);
        reject(err);
      } else {
        if (DEBUG) {
          console.log("RUN WITH params");
          console.log(params);
        }

        resolve({ id: this.lastID });
      }
    });
  });
};

const get = (db: any, sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: any, result: any) => {
      if (err) {
        console.log("Error running sql: " + sql);
        console.log(err);
        reject(err);
      } else {
        if (DEBUG) {
          console.log("GET WITH params");
          console.log(params);
          console.log(result);
        }

        resolve(result);
      }
    });
  });
};

const all = (db: any, sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: any, rows: any[]) => {
      if (err) {
        console.log("Error running sql: " + sql);
        console.log(err);
        reject(err);
      } else {
        console.log("ALL WITH params");
        console.log(params);
        console.log(rows.length);

        resolve(rows);
      }
    });
  });
};

export const init = () => {
  // CREATE TABLES
  db.serialize(async function() {
    db.run(
      `CREATE TABLE IF NOT EXISTS 
       users(id INTEGER PRIMARY KEY AUTOINCREMENT, 
             name TEXT NOT NULL UNIQUE,
             api_key TEXT NOT NULL UNIQUE,
             is_admin BOOLEAN DEFAULT 0)`
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS 
       boxes(id INTEGER PRIMARY KEY AUTOINCREMENT, 
             userId INTEGER, 
             description TEXT NOT NULL UNIQUE)`
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS 
       sensors(id INTEGER PRIMARY KEY AUTOINCREMENT, 
               name TEXT NOT NULL UNIQUE, 
               unit TEXT NOT NULL)`
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS 
       measurements(id INTEGER PRIMARY KEY AUTOINCREMENT, 
       boxId INT NOT NULL, 
       value NUM, 
       sensorId INT NOT NULL, 
       timestamp TEXT NOT NULL, 
       UNIQUE(boxId, sensorId, timestamp))`
    );

    // SEED DATA
    const sensors = [
      {
        name: "Temperature",
        unit: "℃"
      },
      {
        name: "Humidity",
        unit: "%"
      },
      {
        name: "Pressure",
        unit: "Pa"
      },
      {
        name: "Light",
        unit: "Lux"
      },
      {
        name: "Distance",
        unit: "cm"
      },
      {
        name: "Sound",
        unit: "dB"
      }
    ];
    sensors.forEach(async s => {
      await sensor.add(s.name, s.unit);
    });

    const adminHash = await security.hashPassword(security.secrets!.admin, 12);
    await user.add("Stian", adminHash, true);
  });
};

export const measurement = {
  add: async (boxId: number, sensor: number, value: number) => {
    const exists = await box.get(boxId);
    if (!exists) {
      return Promise.reject(`BOX ${boxId} NOT FOUND`);
    }

    const sql =
        "INSERT OR IGNORE INTO measurements(boxId, sensorId, value, timestamp) VALUES (?, ?, ?, ?)",
      params = [boxId, sensor, value, Date.now()];
    return run(db, sql, params);
  },
  all: async (
    boxId: number,
    sensor: number,
    values: number,
    minutes: number
  ) => {
    const timestamp = moment()
      .subtract(minutes, "minutes")
      .valueOf();

    const sql =
        "SELECT timestamp as x, value as y FROM measurements WHERE boxId = ? AND sensorId = ? AND timestamp > ? ORDER BY timestamp desc",
      params = [boxId, sensor, timestamp];
    const result = await all(db, sql, params);
    return LTOB(result, values);
  },
  latest: async (boxId: number, sensor: number) => {
    const sql =
        "SELECT timestamp as x, value as y FROM measurements WHERE boxId = ? AND sensorId = ? ORDER BY timestamp desc LIMIT 1",
      params = [boxId, sensor];
    return get(db, sql, params);
  }
};

export const box = {
  all: async () => {
    const sql = `select boxes.id, boxes.description, users.id as ownerId, users.name as ownerName from users left join boxes on users.id = boxes.userId`;
    return all(db, sql);
  },
  allByUserId: async (userId: string) => {
    const sql = "SELECT * FROM boxes WHERE userId = ?",
      params = [userId];
    return all(db, sql, params);
  },
  add: async (userId: number, description: string) => {
    const sql =
        "INSERT OR IGNORE INTO boxes(userId, description) VALUES (?, ?)",
      params = [userId, description];
    return run(db, sql, params);
  },
  get: async (boxId: number) => {
    const sql = `SELECT * FROM boxes WHERE boxes.id = ?`;
    return get(db, sql, [boxId]);
  }
};

export const sensor = {
  all: async () => {
    const sql = "SELECT * FROM sensors";
    return all(db, sql);
  },
  add: async (name: string, unit: string) => {
    const sql = `INSERT OR IGNORE INTO sensors(name, unit) VALUES(?, ?)`,
      params = [name, unit];
    return run(db, sql, params);
  },
  get: async (sensorId: number) => {
    const sql = `SELECT * FROM sensors WHERE id = ?`;
    return get(db, sql, [sensorId]);
  }
};

export const user = {
  all: async () => {
    const sql = "SELECT id, name FROM users";
    return all(db, sql);
  },
  add: async (name: string, api_key: string, is_admin: boolean = false) => {
    const sql = `INSERT OR IGNORE INTO users(name, api_key, is_admin) VALUES(?, ?, ?)`,
      params = [name, api_key, is_admin];
    return run(db, sql, params);
  },
  get: async (userId: number) => {
    const sql = `SELECT users.id, users.name FROM users 
                 INNER JOIN boxes 
                 ON users.id = boxes.userId 
                 WHERE users.id = ?`;
    return get(db, sql, [userId]);
  },
  getFullUser: async (userId: number) => {
    const sql = `SELECT * FROM users WHERE id = ?`;
    return get(db, sql, [userId]);
  },
  update: async (userId: number, changes: any) => {
    const existing = await user.getFullUser(userId),
      update = { ...existing, ...changes };
    const sql = `UPDATE users SET name = ?, api_key = ?, is_admin = ? WHERE id = ?`,
      params = [update.name, update.api_key, update.is_admin, userId];
    return run(db, sql, params);
  }
};
