import express = require("express");
import bodyParser = require("body-parser");
import cors = require("cors");
import { Guid } from "guid-typescript";
import * as db from "./db";
import * as security from "./security";

const AUTHORIZE = true;

const app = express();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// CORS
app.use(cors());

// Error handling
const port = process.env.NODE_PORT || 8080; // set our port

// ROUTES FOR OUR API
// =============================================================================
const router = express.Router(); // get an instance of the express Router

router.get("/", async (req, res) => {
  res.json({
    "[GET] /health": "health check / ping",
    "[GET] /sensors": "lists sensors",
    "[GET] /users": "lists users",
    "[GET] /users/:userId": "details about given user",
    "[GET] /users/:userId/boxes": "lists boxes belonging to given user",
    "[POST] /users/:userId/boxes":
      "{description: string;} - add box for user with given description",
    "[GET] /boxes": "lists boxes",
    "[GET] /boxes/:boxId": "details about given box",
    "[GET] /boxes/:boxId/sensors": "lists available sensors for given box",
    "[GET] /boxes/:boxId/sensors/:sensor?values=x&minutes=y":
      "returns a decimated list of measurements for sensor of given box, where x is number of returned values from the last y minutes from now",
    "[GET] /boxes/:boxId/sensors/:sensor/latest":
      "returns most recent datapoint for sensor of given box",
    "[GET] /boxes/:boxId/sensors/:sensor/add/:measurement":
      "Adds measurement to the given box, for given sensor",
    "[POST] /admin/:adminId/users":
      "{name: string; is_admin: boolean} - add user",
    "[POST] /admin/:adminId/apikey/:userId":
      "{} - generate new api key for given user",
    "[POST] /admin/:adminId/sensors":
      "{name: string; unit: string;} - add sensor",
    "[DELETE] /admin/:adminId/sensors": "{id: number;} - remove sensor",
    "[DELETE] /admin/:adminId/users": "{id: number;} - remove user",
    "[DELETE] /admin/:adminId/boxes": "{id: number;} - remove box"
  });
});

router.get("/health", async (_req, res) => {
  res.sendStatus(200);
});

// SENSORS
router.get("/sensors", async (req, res) => {
  const data = await db.sensor.all();
  res.json(data);
});

router.get("/sensors/:sensorId", async (req, res) => {
  const { sensorId } = req.params;
  const data = await db.sensor.get(Number(sensorId));
  res.json(data);
});

// BOXES
router.get("/boxes", async (req, res) => {
  const data = await db.box.all();
  res.json(data);
});

router.get("/boxes/:boxId", async (req, res) => {
  const { boxId } = req.params;
  const data = await db.box.get(Number(boxId));
  res.json(data);
});

router.get("/boxes/:boxId/sensors", async (req, res) => {
  const { boxId } = req.params,
    data = await db.sensor.all();

  res.json(data);
});

router.get("/boxes/:boxId/sensors/:sensor", async (req, res) => {
  const { boxId, sensor } = req.params,
    { values, minutes } = req.query,
    data = await db.measurement.all(
      Number(boxId),
      Number(sensor),
      Number(values ?? 100),
      Number(minutes ?? 43830) // a month in minutes
    );

  res.json({
    boxId: Number(boxId),
    sensor: Number(sensor),
    data
  });
});

router.get("/boxes/:boxId/sensors/:sensor/latest", async (req, res) => {
  const { boxId, sensor } = req.params,
    data = await db.measurement.latest(Number(boxId), Number(sensor));

  res.json({
    boxId: Number(boxId),
    sensor: Number(sensor),
    data
  });
});

router.get(
  "/boxes/:boxId/sensors/:sensor/add/:value",
  async (req, res, next) => {
    const { boxId, sensor, value } = req.params,
      authorization = req.headers?.authorization ?? "";

    try {
      if (AUTHORIZE) {
        const box = await db.box.get(Number(boxId)),
          user = await db.user.getFullUser(box.userId),
          is_authorized = await security.compare(authorization, user.api_key);

        if (!is_authorized) {
          throw new Error("UnauthorizedError");
        }
      }

      const data = await db.measurement.add(
        Number(boxId),
        Number(sensor),
        Number(value)
      );

      res.json(data);
    } catch (e) {
      res.statusCode = 401;
      res.sendFile(__dirname + "/public/unauthorized.html");
    }
  }
);

// USERS
router.get("/users", async (req, res) => {
  const data = await db.user.all();

  res.json(data);
});

router.get("/users/:userId", async (req, res) => {
  const { userId } = req.params,
    data = await db.user.get(Number(userId));

  res.json(data);
});

router.get("/users/:userId/boxes", async (req, res) => {
  const { userId } = req.params,
    data = await db.box.allByUserId(userId);

  res.json(data);
});

router.post("/users/:userId/boxes", async (req, res) => {
  const { description } = req.body,
    { userId } = req.params,
    authorization = req.headers?.authorization ?? "";

  try {
    if (AUTHORIZE) {
      const user = await db.user.getFullUser(Number(userId)),
        is_authorized = await security.compare(authorization, user.api_key);
      if (!is_authorized) {
        throw new Error("UnauthorizedError");
      }
    }

    const data = await db.box.add(Number(userId), description);
    res.json(data);
  } catch (e) {
    res.statusCode = 401;
    res.sendFile(__dirname + "/public/unauthorized.html");
  }
});

// ADMIN
router.post("/admin/:adminId/users", async (req, res) => {
  const { name, is_admin } = req.body,
    { adminId } = req.params,
    authorization = req.headers?.authorization ?? "";

  try {
    if (AUTHORIZE) {
      const user = await db.user.getFullUser(Number(adminId)),
        is_authorized = await security.compare(authorization, user.api_key);

      if (!user.is_admin || !is_authorized) {
        throw new Error("UnauthorizedError");
      }
    }

    const api_key = Guid.create(),
      hash = await security.hashPassword(api_key.toString(), 12);
    const data = await db.user.add(name, hash, is_admin);
    res.json({ ...data, name, api_key: api_key.toString() });
  } catch (e) {
    res.statusCode = 401;
    res.sendFile(__dirname + "/public/unauthorized.html");
  }
});

router.post("/admin/:adminId/apikey/:userId", async (req, res) => {
  const { adminId, userId } = req.params,
    authorization = req.headers?.authorization ?? "";

  try {
    if (AUTHORIZE) {
      const adminUser = await db.user.getFullUser(Number(adminId)),
        is_authorized = await security.compare(
          authorization,
          adminUser.api_key
        );

      if (!adminUser.is_admin || !is_authorized) {
        throw new Error("UnauthorizedError");
      }
    }

    const api_key = Guid.create().toString(),
      hash = await security.hashPassword(api_key, 12),
      data = await db.user.update(Number(userId), { api_key: hash });

    res.json({ ...data, api_key: api_key });
  } catch (e) {
    res.statusCode = 401;
    res.sendFile(__dirname + "/public/unauthorized.html");
  }
});

router.post("/admin/:adminId/sensors", async (req, res) => {
  const { name, unit } = req.body,
    { adminId } = req.params,
    authorization = req.headers?.authorization ?? "";

  try {
    if (AUTHORIZE) {
      const user = await db.user.getFullUser(Number(adminId)),
        is_authorized = await security.compare(authorization, user.api_key);

      if (!user.is_admin || !is_authorized) {
        throw new Error("UnauthorizedError");
      }
    }
    const data = await db.sensor.add(name, unit);
    res.json(data);
  } catch (e) {
    res.statusCode = 401;
    res.sendFile(__dirname + "/public/unauthorized.html");
  }
});

router.delete("/admin/:adminId/sensors", async (req, res) => {
  const { id } = req.body,
    { adminId } = req.params,
    authorization = req.headers?.authorization ?? "";

  try {
    if (AUTHORIZE) {
      const user = await db.user.getFullUser(Number(adminId)),
        is_authorized = await security.compare(authorization, user.api_key);

      if (!user.is_admin || !is_authorized) {
        throw new Error("UnauthorizedError");
      }
    }
    const data = await db.sensor.remove(id);
    res.json(data);
  } catch (e) {
    res.statusCode = 401;
    res.sendFile(__dirname + "/public/unauthorized.html");
  }
});

router.delete("/admin/:adminId/boxes", async (req, res) => {
  const { id } = req.body,
    { adminId } = req.params,
    authorization = req.headers?.authorization ?? "";

  try {
    if (AUTHORIZE) {
      const user = await db.user.getFullUser(Number(adminId)),
        is_authorized = await security.compare(authorization, user.api_key);

      if (!user.is_admin || !is_authorized) {
        throw new Error("UnauthorizedError");
      }
    }
    const data = await db.box.remove(id);
    res.json(data);
  } catch (e) {
    res.statusCode = 401;
    res.sendFile(__dirname + "/public/unauthorized.html");
  }
});

router.delete("/admin/:adminId/users", async (req, res) => {
  const { id } = req.body,
    { adminId } = req.params,
    authorization = req.headers?.authorization ?? "";

  try {
    if (AUTHORIZE) {
      const user = await db.user.getFullUser(Number(adminId)),
        is_authorized = await security.compare(authorization, user.api_key);

      if (!user.is_admin || !is_authorized) {
        throw new Error("UnauthorizedError");
      }
    }
    const data = await db.user.remove(id);
    res.json(data);
  } catch (e) {
    res.statusCode = 401;
    res.sendFile(__dirname + "/public/unauthorized.html");
  }
});

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use("/api", router);

// START THE SERVER
// =============================================================================
db.init();

app.listen(port);

console.log("Server started on:" + port);
