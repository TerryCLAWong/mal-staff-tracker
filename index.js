const express = require('express')
const bodyParser = require('body-parser')
const routes = require('./routes/api')
require("express-validator")
require('dotenv').config()

const app = express()

const port = process.env.PORT || 5000;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
})

app.use(bodyParser.json())
//TODO add middle wear to refresh access token
app.use('/api', routes);

app.use((err, req, res, next) => {
    console.log(err);
    next()
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})