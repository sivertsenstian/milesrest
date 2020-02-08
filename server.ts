import express = require('express'); 
import bodyParser = require('body-parser'); 
import cors = require('cors');
import fs = require('fs');
import * as db from "./db";

let SECRETS : {[key: string]: string};
try {
    const rawdata = fs.readFileSync('./_secret.json');
    SECRETS = JSON.parse(rawdata.toString());
    console.log("SECRET LOADED OK!");
    console.log(SECRETS);

} catch (e) {
    console.log(" ==== ERROR ====");
    console.log("MISSING SECRET! - add _secret.json with list of {boxId: 'secret_to_verify'}");
    console.log(" ====       ====");
    process.exit(1);
}

const app = express();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(bodyParser.json());

// CORS
app.use(cors())


// Error handling
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
        "/boxes/:boxId/sensors/:sensor": "lists measurements for sensor of given box",
        "/boxes/:boxId/sensors/:sensor/add/:measurement": "Adds measurement to the given box, for given sensor",
    });   
});

router.get('/sensors', async (req, res) => {
    const data = await db.sensors();

    res.json(data);   
});

router.get('/boxes/:boxId/sensors/:sensor', async (req, res) => {
    const {boxId, sensor} = req.params,
    {values, limit} = req.query,
    data = await db.all(Number(boxId), Number(sensor), Number(values ?? 100), Number(limit ?? 1000)); 

    res.json({
        boxId: Number(boxId),
        sensor: Number(sensor),
        data
    });   
});

router.get('/boxes/:boxId/sensors/:sensor/latest', async (req, res) => {
    const {boxId, sensor} = req.params,
    data = await db.latest(Number(boxId), Number(sensor)); 

    res.json({
        boxId: Number(boxId),
        sensor: Number(sensor),
        data
    });   
});

router.get('/boxes/:boxId/sensors/:sensor/add/:value', async (req, res, next) => {
    const {boxId, sensor, value} = req.params,
    {authorization} = req.headers;

    try {
        if (process.env.NODE_ENV === "development" && authorization !== SECRETS[boxId]) {
            throw new Error("UnauthorizedError");
        }

        const data = await db.add(Number(boxId), Number(sensor), Number(value));

        res.json(data);   
    } catch(e) {
        res.statusCode = 401;
        res.sendFile(__dirname + '/public/unauthorized.html');
    }
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

router.get('/health', async (_req, res) => {
    res.sendStatus(200); 
});

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
db.init();
app.listen(port);

console.log('Server startet on:' + port);
