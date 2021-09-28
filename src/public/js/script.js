'use strict'

// set defaults and constants
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const defaultNewsSource = 'bbc-news';
const refreshButtons = [
    'news-refresh',
    'tfl-departures-refresh',
    'tfl-status-refresh',
    'forecast-refresh',
    'weather-refresh'
]
var currentNewsSource = defaultNewsSource;
const defaultStation = '940GZZLUFCN'; // Farringdon Station
var currentStation = defaultStation;
const TflLines = [
    {name: 'Bakerloo',
    value: 'bakerloo'},
    {name: 'District',
    value: 'district'},
    {name: 'Hammersmith & City',
    value: 'hammersmith-city'},
    {name: 'Circle',
    value: 'circle'},
    {name: 'Jubilee',
    value: 'jubilee'},
    {name: 'Central',
    value: 'central'},
    {name: 'Northern',
    value: 'northern'},
    {name: 'Metropolitan',
    value: 'metropolitan'},
    {name: 'Piccadilly',
    value: 'piccadilly'},
    {name: 'Victoria',
    value: 'victoria'},
    {name: 'Waterloo & City',
    value: 'waterloo-city'}
    ]
const defaultLine = 'hammersmith-city';
var currentLine = defaultLine;
const serviceWorkerEnabled = true; // can be set to false for debugging


(function() {
    // register service worker (Dependent on the service worker feature toggle)
    if('serviceWorker' in navigator && serviceWorkerEnabled){
        try {
            navigator.serviceWorker.register('../sw1.js')
            console.log('Service worker registered')
        } catch (error) {
            console.log('Service worker failed to register')
        }
    }

    // display date and time
    displayDate();
    console.log('network check');

    // update date, time and network status every second
    setInterval(function() {
        displayDate();
        checkNetwork();
    }, 1000);

    // get location and then get weather
    getLocation(function(){
        getWeather();
        getForecast();
    })
    // get location and then get weather every 10 minutes
    setInterval(function(){getLocation(function(){getWeather();getForecast();})}, 1000*60*10);

    // get tfl statuses
    getTflStatus()
    // get tfl statuses every 3 mins
    setInterval(function(){getTflStatus()},1000*60*3)

    displayTflLines();
    getTflStations();
    getTflDepartures();

    let lineSelector = document.getElementById('tfl-lines')
    let stationSelector = document.getElementById('tfl-stations')
    lineSelector.addEventListener('change', event => {
        currentLine = event.target.value;
        getTflStations();
    }); // update stations list when the line is changed

    stationSelector.addEventListener('change', event => {
        if (event.target.value){
            currentStation = event.target.value;
            console.log('Updating departures')
            getTflDepartures();
        }   
    })

    getNewsSources()
    getNews()
    // get news every 15 mins
    setInterval(function(){getNews()},1000*60*15)

    // get news when source changes
    let newsSourceSelector = document.getElementById('news-sources')
    newsSourceSelector.addEventListener('change', event => {
        currentNewsSource = event.target.value;
        getNews()
    });

    // set up event listeners on all the refresh buttons -- TODO: enhance these using a for loop and add the resultant functions into an array of objects in the document constants.
    let weatherRefresh = document.getElementById('weather-refresh')
    weatherRefresh.addEventListener('click', function(){
        getWeather();
    });

    let forecastRefresh = document.getElementById('forecast-refresh')
    forecastRefresh.addEventListener('click', function(){
        getForecast();
    });

    let tflStatusRefresh = document.getElementById('tfl-status-refresh')
    tflStatusRefresh.addEventListener('click', function(){
        getTflStatus();
    });

    let tflDeparturesRefresh = document.getElementById('tfl-departures-refresh')
    tflDeparturesRefresh.addEventListener('click', function(){
        getTflDepartures();
    });

    let newsRefresh = document.getElementById('news-refresh')
    newsRefresh.addEventListener('click', function(){
        getNews();
    });

})(this);

// get and display the current date and time within the HMTL document
function displayDate() {
    var date = new Date();
    var time = new Date().toLocaleString([], {   
        hour12: false,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        //timeZoneName: 'short',
        //weekday: 'long', 
        //year: 'numeric', 
        //month: 'long', 
        //day: 'numeric'
    });
    var dateElement = document.getElementById('date');
    var dayElement = document.getElementById('day');
    var timeElement = document.getElementById('time');

    var weekday = days[date.getDay()];
    var day = date.getDate();
    var month = months[date.getMonth()];
    var year = date.getFullYear();

    dateElement.innerHTML = day + ' ' + month + ' ' + year;
    dayElement.innerHTML = weekday;
    timeElement.innerHTML = time + '';
}

// ping the server and await a response. If the response changes then show then toggle online/offline
function checkNetwork(){
    // console.log('CALLING PING')
    var request = new XMLHttpRequest();
    request.open('GET', '/ping', true);
    request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
            toggleOnline('online')
        } else {
            toggleOnline('offline')
        }
    };
    request.onerror = function() {
        toggleOnline('offline')
    };
    request.send();
}

// change state from online to offline & vise-versa
function toggleOnline(status){
    if (status == 'offline'){
        // offline
        document.getElementById('offline').style.visibility = "visible"
        document.getElementById('body').style.marginTop = '30px';
        for (var i = 0; i < refreshButtons.length; i++){
            document.getElementById(refreshButtons[i]).disabled = true;
        }
    }
    else{
        // online
        document.getElementById('offline').style.visibility = "hidden"
        document.getElementById('body').style.marginTop = '0px';
        for (var i = 0; i < refreshButtons.length; i++){
            document.getElementById(refreshButtons[i]).disabled = false;
        }
    }
}

// get the user's current location from the browser's geolocation
function getLocation(callback) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            sendPosition(position, callback);
        }, function(errorCode) {
            callback();
        });
    } else {
        // location is not supported
        console.log('Geolocation is not supported by this browser.');
        callback();
    }
}

// send the user's current location to the server. Using the default value if necessary.
function sendPosition(position, callback) {
    console.log(position);
    var lat = position.coords.latitude;
    var long = position.coords.longitude;
    var coords = { lat, long };
    var request = new XMLHttpRequest();
    request.open('POST', '/coord', true);
    request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    request.send(JSON.stringify(coords));
    request.onreadystatechange = function() {
        if (request.readyState === 4 && request.status === 200) {
            callback();
        }
        // otherwise error, then default value
    }
}

// request the current weather from the server 
function getWeather() {
    var request = new XMLHttpRequest();
    request.open('GET', '/weather', true);
    request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
            var data = JSON.parse(request.responseText);
            displayWeather(data);
        } else {
            console.log('something went very wrong :(', request.statusText);
        }
    };
    request.onerror = function() {
        console.log('error', request.statusText);
    };
    request.send();
}

// display the current weather in the html page
function displayWeather(response) {
    let time = updateTimeRecord('weather-refresh')
    var temperature = response.temperature
    var icon = response.icon
    var summary = response.description
    var humidity = response.humidity
    var windSpeed = response.windSpeed
    var windDirection = response.windDirection

    document.getElementById('current-weather').innerHTML = `
                <div class="weather">
                    <div class='icon'>
                    <img id="icon" src='/images/weather/${icon}@2x.png'\>
                    </div>
                    <div class='description'>
                    <span id="summary">${summary}</span>
                    <div class='description-row'>
                        <span>Temp:</span>
                        <span id="temp">${temperature}</span>
                    </div>
                    <div class='description-row'>
                        <span>Humidity:</span>
                        <span id="humidity">${humidity}</span>
                    </div>
                    <div class='description-row'>
                        <span>Wind Speed:</span>
                        <span id="wind-speed">${windSpeed}</span>
                    </div>
                    <div class='description-row'>
                        <span>Wind Direction:</span>
                        <span id="wind-direction">${windDirection}</span>
                    </div>
                    </div>
                </div> `
}

// get the weather forecast from the server
function getForecast() {
    var request = new XMLHttpRequest();
    request.open('GET', '/forecast', true);
    request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
            var data = JSON.parse(request.responseText);
            displayForecast(data);
        } else {
            console.log('something went very wrong :(', request.statusText);
        }
    };
    request.onerror = function() {
        console.log('error', request.statusText);
    };
    request.send();
}

// display the weather forecast in the html page
function displayForecast(response) {
    let forecastWidget = document.getElementById('forecast')
    let time = updateTimeRecord('forecast-refresh')
    forecastWidget.innerHTML = ``
    let todayDate = (new Date()).getDate()
    let max = 4
    let count = 0
    for (var i = 0; i < response.length; i++){
        let forecastDate = new Date( parseInt(response[i].date) * 1000) // create date
        if (forecastDate.getDate() != todayDate && count < max){
            count++
            forecastDate = days[forecastDate.getDay()] + ' ' + forecastDate.getDate() + ' ' + months[forecastDate.getMonth()] + ' ' + forecastDate.getFullYear()
            let forecastIcon = response[i].icon
            let forecastTemperature = response[i].temperature
            let forecastDescription = response[i].description
            let forecastHumidity = response[i].humidity
            let forecastWindSpeed = response[i].windSpeed
            let forecastWindDirection = response[i].windDirection
            forecastWidget.innerHTML += `
                <div class="weather">
                    <div class='icon'>
                    <img id="icon" src='/images/weather/${forecastIcon}@2x.png'\>
                    </div>
                    <div class='description'>
                    <h3 id="date">${forecastDate}</h3>
                    <span id="summary">${forecastDescription}</span>
                    <div class='description-row'>
                        <span>Temp:</span>
                        <span id="temp">${forecastTemperature}</span>
                    </div>
                    <div class='description-row'>
                        <span>Humidity:</span>
                        <span id="humidity">${forecastHumidity}</span>
                    </div>
                    <div class='description-row'>
                        <span>Wind Speed:</span>
                        <span id="wind-speed">${forecastWindSpeed}</span>
                    </div>
                    <div class='description-row'>
                        <span>Wind Direction:</span>
                        <span id="wind-direction">${forecastWindDirection}</span>
                    </div>

                    </div>
                </div> `
        }
    }
}

// get the list of news sources from the server
function getNewsSources(){
    var request = new XMLHttpRequest();
    request.open('GET', '/news/sourcelist', true)
    request.onload = function () {
        if (request.status >= 200 && request.status < 400) {
            displaySources(JSON.parse(request.responseText))
        } else {
            console.log('News Sources Error', request.statusText);
        }
    };
    request.onerror = function () {
        console.log('request error: ' + request.statusText)
    };
    request.send();
}

// display the list of news sources in the selector in the hmtl
function displaySources(res){
    let mySelector = document.getElementById('news-sources')
        mySelector.innerHTML = 
            res.sources
            .map(source => `<option value="${source.id}">${source.name}</option>`)
            .join('\n');
    mySelector.value = defaultNewsSource
}

// get the news stories for the current news source from the server
function getNews() {
    var request = new XMLHttpRequest();
    request.open('GET', '/news/'+currentNewsSource, true);
    request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
            displayNews(JSON.parse(request.responseText))
        } else {
            console.log('something went very wrong :(', request.statusText);
        }
    };
    request.onerror = function() {
        console.log('request error:' + request.statusText);
    };
    request.send();
}

// create a news articles html element
function createArticle(article){
    return `
    <div class='article'>
        <a href="${article.url}">
            <h2>${article.title}</h2>
            <img src='${article.urlToImage}'>
            <p>${article.description}</p>
        </a>
    </div>`;

}

// create and display news articles within the html document
function displayNews(res) {
    updateTimeRecord('news-refresh')
    let main = document.getElementById('news')
    let myHTML = ``
    for (var i = 0; i < res.length; i++){
        myHTML += createArticle(res[i])
    }
    main.innerHTML = myHTML
}

// request the tfl status from the server
function getTflStatus() {
    var request = new XMLHttpRequest();
    request.open('GET', '/tflStatus', true);
    request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
            var data = JSON.parse(request.responseText);
            displayTflStatus(data);
        } else {
            console.log('something went very wrong :(', request.statusText);
        }
    };
    request.onerror = function() {
        console.log('error', request.statusText);
        
    };
    request.send();
}


// display the tfl status in the html
function displayTflStatus(response) {
    updateTimeRecord('tfl-status-refresh')
    for (let [key, value] of Object.entries(response)) {
        document.getElementById(key).innerText = value
    }
}

// load the tfl tube lines into the selector in the html
function displayTflLines(){
    let lineSelector = document.getElementById('tfl-lines')
    for (var i = 0; i< TflLines.length; i++){
        lineSelector.innerHTML += `<option value="${TflLines[i].value}">${TflLines[i].name}</option>`
    }
    lineSelector.value = currentLine
}

// get the tfl statins for the currently selected line
function getTflStations() {
    var request = new XMLHttpRequest();
    // currentLine = document.getElementById('tfl-lines').value
    let url = '/tflStations/'+currentLine
    request.open('GET', url, true);
    request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
            var data = JSON.parse(request.responseText);
            displayTflStations(data)
        } else {
            console.log('something went very wrong :(', request.statusText);
        }
    };
    request.onerror = function() {
        console.log('error', request.statusText);
    };
    request.send();
}

// display the retrieved tfl stations in the html selector
function displayTflStations(res){
    document.getElementById('departures').innerHTML = 'Plase select a station...'
    let mySelector = document.getElementById('tfl-stations')
    mySelector.innerHTML = ''
    for (var i = 0; i < res.length; i++){
        mySelector.innerHTML += `<option value="${res[i].id}">${res[i].name}</option>`
    }
    try {
        mySelector.value = defaultStation
    } catch (error) {
        console.log('Default setting wrong')
    }
    
}

// get the departures for a given station from the server
function getTflDepartures() {
    var request = new XMLHttpRequest();
    let url = '/tflDepartures/' + currentStation
    request.open('GET', url, true);
    request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
            var data = JSON.parse(request.responseText);
            displayTflDepartures(data);
        } else {
            console.log('something went very wrong :(', request.statusText);
        }
    };
    request.onerror = function() {
        console.log('error', request.statusText);
    };
    request.send();
}

// display the departures in the html
function displayTflDepartures(response) {
    updateTimeRecord('tfl-departures-refresh')
    
    let loopmax = 5
    if (response.length == 0){
        document.getElementById('departures').innerHTML = '<p> No Departures </p>'
        return
    }
    else if( response.length < loopmax ){
        loopmax = response.length
    }
    document.getElementById('departures').innerHTML = ''
    for (var i = 0; i < loopmax; i++){
        document.getElementById('departures').innerHTML += '<p>' + response[i].line +' line to '+ response[i].towards +' in '+ response[i].minDiff + 'mins </p>'
    }
}

// update a given html element to show the time last updated - for use with the update buttons
function updateTimeRecord(elementId){
    let time = getTimeFormatted()
    document.getElementById(elementId).innerHTML = `Last Updated: ${time}`
    
}

// returns the formatted time
function getTimeFormatted(){
    let time = new Date()
    let seconds = time.getSeconds()
    let minutes = time.getMinutes()
    let hours = time.getHours()
    if (seconds < 10){
        seconds = '0' + seconds
    }
    if (minutes < 10){
        minutes = '0' + minutes
    }
    if (hours < 10){
        hours = '0' + hours
    }
    time = hours +':'+ minutes +':'+ seconds
    return time
}