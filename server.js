'use strict';
// set port number globally for the server
const portNumber = 3000;

// import dependencies
const superagent = require('superagent');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const openWeatherMapKey = '1d43300625d4e05b2d7dbe2d33dd898b'
const newsApiKey = 'f933d57c326448e2b2ed0cdba431d4a8'

const defaultLocation = { // default location is Trafalgar Square
    lat: '51.5080',
    long: '0.1281'
}
var currentLocation = defaultLocation

// load the directory source
app.use(express.static(__dirname + '/src/public'));

// parse application/x-www-form-urlencoded 
app.use(bodyParser.urlencoded({ extended: false }));
 
// parse application/json 
app.use(bodyParser.json());

// send the html file for the base url
app.get('/', (req, res) => {
    res.sendFile('index.html');
});

// return 200 for any ping request
app.get('/ping', (req, res) => {
    return res.sendStatus(200);
})


// Receives coordinates from html5 geolocation
app.post('/coord', (req,res) => {
    if (!req.body){
        return res.sendStatus(400);
    }
    else{
        currentLocation.lat = req.body.lat;
        currentLocation.long = req.body.long;
        return res.sendStatus(200);
    }
})

// get the current weather for the current location
app.get('/weather', (req, res) => {
    superagent.get(`https://api.openweathermap.org/data/2.5/weather?units=metric&lat=${currentLocation.lat}&lon=${currentLocation.long}&APPID=${openWeatherMapKey}`)
        .then(data => {
            data = data.body
            var myResponse = {} 
            myResponse.temperature = Math.round(data.main.temp) + '°C'// validate
            myResponse.humidity = data.main.humidity + '%'
            myResponse.description = data.weather[0].description // validate
            myResponse.sunrise = new Date(parseInt(data.sys.sunrise)*1000)
            myResponse.sunset = new Date(parseInt(data.sys.sunset)*1000)
            myResponse.windDirection = data.wind.deg + '°'
            myResponse.windSpeed = data.wind.speed +' m/s'
            myResponse.icon = data.weather[0].icon
            res.write(JSON.stringify(myResponse))
            res.end()
        })
        .catch((error) => {
            console.log('API Error (Weather)' + error)
        })
});

// get the weather forecast for the current location
app.get('/forecast', (req, res) => {
    superagent.get(`https://api.openweathermap.org/data/2.5/forecast?units=metric&lat=${currentLocation.lat}&lon=${currentLocation.long}&APPID=${openWeatherMapKey}`)
        .then(data => {
            // returns a 3 hour forecast
            data = data.body
            data = data.list
            var forecast = []
            for (let i=0; i < data.length; i++){
                if (data[i].dt_txt.endsWith('15:00:00')){
                    forecast.push(data[i])
                }
            }
            var myResponse = []
            for (var j = 0; j< forecast.length; j++){
                myResponse.push({
                    date: forecast[j].dt,
                    temperature: Math.round(forecast[j].main.temp) + '°C',
                    humidity: forecast[j].main.humidity + '%',
                    description: forecast[j].weather[0].description,
                    windSpeed: forecast[j].wind.speed +' m/s',
                    windDirection: forecast[j].wind.deg + '°',
                    icon: forecast[j].weather[0].icon
                })
            }
            res.write(JSON.stringify(myResponse))
            res.end()
        })
        .catch((error) => {
            console.log('Weather API Error (forecast): '+error)
        })
});


// get the list of news sources
app.get('/news/sourcelist', (req, res) => {
    var url = 'https://newsapi.org/v2/sources?apiKey=' + newsApiKey
    superagent.get(url)
        .then(data => {
            res.write(JSON.stringify(data.body))
            res.end()
        })
        .catch((error) => {
            console.log('News API Error (Sources): ' + error)
        })
});

// get the news headlines for a given source
app.get('/news/:source', (req, res) => {
    var url = 'http://newsapi.org/v2/top-headlines?sources=' +
    req.params.source +
    '&apiKey='+newsApiKey
    superagent.get(url)
        .then(data => {
            res.write(JSON.stringify(data.body.articles))
            res.end()
        })
        .catch((error) => {
            console.log('News API Error (Articles): ' + error)
        })
});

// Get tfl Status for tube lines
app.get('/tflStatus', (req, res) => {
    var lineStatuses = {}
    superagent.get('https://api.tfl.gov.uk/line/mode/tube/status')
    .then(data => {
        data = data.body
        for (var i = 0; i < data.length; i++){
          lineStatuses[data[i].id] = data[i].lineStatuses[0].statusSeverityDescription
        } 
      res.write(JSON.stringify(lineStatuses))
      res.end()
    })
    .catch((error) => {
        console.log('API Error (TFLStatus)')
    })
})

// Get tfl departures for a given station
app.get('/tflDepartures/:station', (req, res) => {
    let station = req.params.station
    superagent.get('https://api.tfl.gov.uk/StopPoint/'+station+'/arrivals')
    .then(data => {
      data = data.body
      var expectedTrains = []
      for (var i = 0; i < data.length; i++) {
          var towards = data[i].towards.toLowerCase()
          var platform = data[i].platformName
          var platformNumber = ((platform.substring((platform.indexOf(" "))+1,-1)).replace(/\s/g, '')).toLowerCase()
          var line = data[i].lineName
          var timeStamp = new Date(data[i].timestamp)
          var expected = new Date(data[i].expectedArrival)
          var diff = Math.abs(expected - timeStamp)
          var minDiff = (diff / 60 / 1000).toFixed(0)
          if (expectedTrains.length < 5){
            expectedTrains.push({line, towards, platform, expected, minDiff})
          }
      }
      res.write(JSON.stringify(expectedTrains))
      res.end()
    })
    .catch((error) => {
      console.log('TFL API error (Departures): ' + error)
      return false
  })
  })

// Get tfl stations for a given line
  app.get('/tflStations/:line', (req, res) => {
    var stationList = []
    let line = req.params.line
    superagent.get('https://api.tfl.gov.uk/Line/'+line+'/StopPoints')
    .then(data => {
        data = data.body
        for (var i = 0; i < data.length; i++) {
            let myStation = {
                name: data[i].commonName,
                id: data[i].id
                }
                stationList.push(myStation)
        }
        res.write(JSON.stringify(stationList))
        res.end()
    })
    .catch((error) => {
        console.log('TFL API error (stations): ' + error)
        return false
    }) 
  })


// All other addresses (Keep this last!)
app.use(function(req, res, next){
    //res.status(404);

    // respond with html page
    // if (req.accepts('html')) {
    //     res.render('404', { url: req.url });
    //     return;
    // }

    // // respond with json
    // if (req.accepts('json')) {
    //     res.send({ error: 'Not found' });
    //     return;
    // }

    // default to plain-text. send()
    //res.type('txt').send('Not found - lol at you');
    res.redirect('/')
});


// start server
app.listen(portNumber, () => {
    console.log('Express server started on localhost:'+portNumber);
});


