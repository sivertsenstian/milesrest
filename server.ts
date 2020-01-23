import express = require('express'); 
import bodyParser = require('body-parser'); 
import cors = require('cors');
import * as db from "./db";

const app = express();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(bodyParser.json());

// CORS
app.use(cors())

const port = process.env.NODE_PORT || 8080;        // set our port

// ROUTES FOR OUR API
// =============================================================================
const router = express.Router();              // get an instance of the express Router

router.get('/', async (req, res) => {
    res.json({
        "/boxes": "lists available boxes",
        "/sensors": "lists available sensors",
        "/boxes/:boxId": "details about given box",
        "/boxes/:boxId/sensors": "lists available sensors for given box",
        "/boxes/:boxId/sensors/:sensor": "lists measurements for sensor for given box",
    });   
});

router.get('/sensors', async (req, res) => {
    const data = await db.sensors();

    res.json(data);   
});

router.get('/boxes/:boxId/sensors/:sensor', async (req, res) => {
    const {boxId, sensor} = req.params,
    data = await db.all(Number(boxId), Number(sensor));

    res.json({
        boxId: Number(boxId),
        sensor: Number(sensor),
        data
    });   
});

router.get('/boxes/:boxId/sensors/:sensor/add/:value', async (req, res) => {
    const {boxId, sensor, value} = req.params,
    data = await db.add(Number(boxId), Number(sensor), Number(value));

    res.json(data);   
});

router.get('/boxes', async (req, res) => {
    const data = await db.boxes();

    res.json(data);   
});

router.get('/boxes/:boxId/sensors', async (req, res) => {
    const {boxId} = req.params,
    data = await db.sensors();

    res.json(data);   
});

// more routes for our API will happen here

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
db.init();
app.listen(port);

console.log('Server startet on:' + port);
