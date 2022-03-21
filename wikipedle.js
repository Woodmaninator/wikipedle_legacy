//If you have to look at this code, I am sorry - Woodmaninator

var guesses = 0;
var ready = 0;
var secret = {};
var win = false;
var givenUp = false;
var puzzleNumber = getDayNumber();
secret.title = getArticleOfTheDay(puzzleNumber);
secret.linksInArticle = new Array();
secret.linksToArticle = new Array();

preventReloadOnForm();

httpGetAsync('https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&prop=links&titles=' + secret.title + '&pllimit=500', SetLinksInArticle);
httpGetAsync('https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&prop=linkshere&titles=' + secret.title + '&lhlimit=500', SetLinksToArticle);

loadCookieDataIfAvailable();

function httpGetAsync(url, callback){
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState == 4){
            if(xmlHttp.status == 200){
                callback(xmlHttp.responseText);
            } else {
                apiCallError();   
            }
        }
    }
    xmlHttp.open('GET', url, true); 
    xmlHttp.send(null);
}

function httpGetAsyncAndTrackGuesses(url, callback, linksInCommon, linksTotal, secretLinksToGuess, guessLinksToSecret){
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4){
            if(xmlHttp.status == 200){
                callback(xmlHttp.responseText, linksInCommon, linksTotal, secretLinksToGuess, guessLinksToSecret);
            } else {
                apiCallError();
            }
        }
    }
    xmlHttp.open('GET', url, true);
    xmlHttp.send(null);
}

function apiCallError(){
    updateStatusText('Error','Looks like something went wrong while trying to reach the Wikipedia API.');
    if(ready == 3){
        //Refund one guess
        guesses--;
        setInputDisabled(false);
    } else {
        //Error when loading the links for the secret article.
        setInputDisabled(true);
    }
}

function SetLinksInArticle(responseText){
    var responseObject = JSON.parse(responseText);
    var pagesObject = responseObject.query.pages;

    var firstId = Object.keys(pagesObject)[0];
    
    var linkArray = pagesObject[firstId].links;

    linkArray.forEach(function(item){
        if(item.ns == '0'){
            secret.linksInArticle.push(item.title.toUpperCase());
        }
    });

    if (responseObject.hasOwnProperty('continue')){
        httpGetAsync('https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&prop=links&titles=' + secret.title + '&pllimit=500&plcontinue=' + responseObject.continue.plcontinue, SetLinksInArticle);
    } else {
        increaseReadyCheck();
    }
}

function SetLinksToArticle(responseText){
    var responseObject = JSON.parse(responseText);
    var pagesObject = responseObject.query.pages;

    var firstId = Object.keys(pagesObject)[0];

    var linkArray = pagesObject[firstId].linkshere;

    linkArray.forEach(function(item){
        if(item.ns == '0'){
            secret.linksToArticle.push(item.title);
        }
    });

    if(responseObject.hasOwnProperty('continue')){
        httpGetAsync('https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&prop=linkshere&titles=' + secret.title + '&lhlimit=500&lhcontinue=' + responseObject.continue.lhcontinue, SetLinksToArticle);
    } else {
        increaseReadyCheck();
    }
}

function guess(){
    var guessedArticle = document.getElementById('inputTextBox').value;  
    if(guessedArticle != ''){
        setInputDisabled(true);
        guesses++;
        if(guessedArticle.toUpperCase() == secret.title.toUpperCase()){
            win = true;
            displayWin();
            insertWinToCookie();
        } else {
            httpGetAsync('https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&prop=info&titles=' + guessedArticle, validateGuessCallback);
        }
    }
}

function validateGuessCallback(responseText) {
    var responseObject = JSON.parse(responseText); 
    
    if (Object.keys(responseObject.query.pages)[0] == '-1'){
        //This means that the article is not valid
        updateStatusText('Error', 'The article you guessed does not exist on the English Wikipedia. Keep in mind that articles can be case-sensitive!');
        guesses--;
        setInputDisabled(false);
    } else {
        var guessedArticle = document.getElementById('inputTextBox').value;
        httpGetAsyncAndTrackGuesses('https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&prop=links&titles=' + guessedArticle + '&pllimit=500', guessCallBack, 0, 0, false, false);
    }
}

function guessCallBack(responseText, linksInCommon, linksTotal, secretLinksToGuess, guessLinksToSecret){
    var guessedArticle = document.getElementById('inputTextBox').value;
    
    var responseObject = JSON.parse(responseText);
    var pagesObject = responseObject.query.pages;

    var firstId = Object.keys(pagesObject)[0];
    
    var linkArray = pagesObject[firstId].links;

    linkArray.forEach(function(item){
        if(item.ns == '0'){
            if(secret.linksInArticle.includes(item.title.toUpperCase())){
                linksInCommon++;
            }
            linksTotal++;
            if(!guessLinksToSecret){
                if (item.title.toUpperCase() == secret.title.toUpperCase()){
                    guessLinksToSecret = true;
                }
            }
        }
    });

    if(!secretLinksToGuess){
        if(secret.linksInArticle.includes(guessedArticle.toUpperCase().replace(/_/g,' '))){
            secretLinksToGuess = true;
        }
    }

    if (responseObject.hasOwnProperty('continue')){
        httpGetAsyncAndTrackGuesses('https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&prop=links&titles=' + guessedArticle + '&pllimit=500&plcontinue=' + responseObject.continue.plcontinue, guessCallBack, linksInCommon, linksTotal, secretLinksToGuess, guessLinksToSecret);
    } else {
        if(linksTotal < 50){
            guesses--;
            updateStatusText('Not enough links','Your guess has less than 50 links on the page which means that it is either just an article that redirects to other articles or the article is insignificant.');
            setInputDisabled(false);
        } else {
            completeGuess(linksInCommon, linksTotal, secretLinksToGuess, guessLinksToSecret);
        }
    }
}

function completeGuess(linksInCommon, linksTotal, secretLinksToGuess, guessLinksToSecret){
    var percent = 0;

    if(linksTotal != 0)
        percent = Math.round(linksInCommon / linksTotal * 100);

    updateStatusText('Last Guess: ' + document.getElementById('inputTextBox').value, 'Your guess has ' + percent + '% (' + linksInCommon + '/' + linksTotal + ') of links on the article in common with the secret article.');

    //Put previous guess into previous guess table
    insertPreviousGuessRow(guesses, percent, linksInCommon, linksTotal, document.getElementById('inputTextBox').value, secretLinksToGuess, guessLinksToSecret);
    //Put new table row into table of previous guesses
    insertNewTableRow(guesses, percent, linksInCommon, linksTotal, document.getElementById('inputTextBox').value, secretLinksToGuess, guessLinksToSecret);
    //Insert the guessed row into the cookie
    insertRowToCookie(guesses, percent, linksInCommon, linksTotal, document.getElementById('inputTextBox').value, secretLinksToGuess, guessLinksToSecret);

    setInputDisabled(false);
}

function updateStatusText(header, text){
    document.getElementById('statusHeader').innerHTML = header;
    document.getElementById('statusText').innerHTML = text;
}

function updateSecretText(){
    document.getElementById('secretInfoText1').innerHTML = 'The secret article has ' + secret.linksInArticle.length + ' links on the article.';
    document.getElementById('secretInfoText2').innerHTML = '<br>There are ' + secret.linksToArticle.length + ' articles that point to the secret article.';
}

function displayWin(){
    updateStatusText('You win!', 'The secret article was ' + secret.title + '. You guessed it after ' + guesses + ' guesses.');
    document.getElementById('shareButton').setAttribute('style','visibility:visible;');
}

function setInputDisabled(value){
    document.getElementById('guessButton').disabled = value;
    document.getElementById('inputTextBox').disabled = value;
    document.getElementById('giveUpButton').disabled = value;
    //Also clear the input of the textBox if disabled is set to false
    if(value == false) {
        document.getElementById('inputTextBox').value = '';
        document.getElementById('inputTextBox').focus();
    }
}

function insertPreviousGuessRow(number, percent, linksInCommon, linksTotal, articleTitle, secretLinksToGuess, guessLinksToSecret){
    var row = document.getElementById('previousGuessRow');
    row.children[0].innerHTML = number;
    row.children[1].innerHTML = percent + '% (' + linksInCommon + '/' + linksTotal + ')';
    row.children[2].innerHTML = articleTitle;
    if(guessLinksToSecret)
        row.children[3].innerHTML = '&#10004';
    else
        row.children[3].innerHTML = '&#10006'
    if(secretLinksToGuess)
        row.children[4].innerHTML = '&#10004';
    else
        row.children[4].innerHTML = '&#10006';
}

function insertNewTableRow(number, percent, linksInCommon, linksTotal, articleTitle, secretLinksToGuess, guessLinksToSecret){
    var index = 0;
    var tableBody = document.getElementById('tableBody');
    var currentRows = tableBody.children;
    var newRow;

    if(currentRows.length >= 1){
        while (index < currentRows.length && currentRows[index].children[1].innerHTML.substring(0, currentRows[index].children[1].innerHTML.indexOf('%')) > percent){
            index++;  
        }
        newRow = tableBody.insertRow(index);
    } else {
        newRow = tableBody.insertRow(-1);
    }

    var tdNumber = document.createElement('td');
    tdNumber.innerHTML = number;
    newRow.appendChild(tdNumber);

    var tdPercent = document.createElement('td');
    tdPercent.innerHTML = percent + '% (' + linksInCommon + '/' + linksTotal + ')';
    newRow.appendChild(tdPercent);

    var tdGuess = document.createElement('td');
    tdGuess.innerHTML = articleTitle;
    newRow.appendChild(tdGuess);

    var tdGuessLinksToSecret = document.createElement('td');
    if(guessLinksToSecret)
        tdGuessLinksToSecret.innerHTML = '&#10004';
    else
        tdGuessLinksToSecret.innerHTML = '&#10006'
    newRow.appendChild(tdGuessLinksToSecret);
    
    var tdSecretLinksToGuess = document.createElement('td');
    if(secretLinksToGuess)
        tdSecretLinksToGuess.innerHTML = '&#10004';
    else
        tdSecretLinksToGuess.innerHTML = '&#10006'
    newRow.appendChild(tdSecretLinksToGuess);
}

function giveUp(){
    if (confirm('Are you sure that you want to give up?')) {    
        setInputDisabled(true);
        givenUp = true;
        displayGiveUp();
        insertGiveUpToCookie();
    } 
}

function displayGiveUp(){
    updateStatusText(':(', 'You gave up after ' + guesses + " guesses. The secret word was " + secret.title + '.');
    document.getElementById('shareButton').setAttribute('style','visibility:visible;');
}

function increaseReadyCheck(){
    ready++;
    if(ready == 3){
        if (win == false && givenUp == false){
            setInputDisabled(false);
        }
        updateSecretText();
    }
}

function getWikipedleJsonObjectFromCookie(){
    var name = 'wikipedleObject=';
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return '';
}

function loadCookieDataIfAvailable(){
    var cookieString = getWikipedleJsonObjectFromCookie();
    
    if(cookieString != ''){
        var wikipedleJsonCookie = JSON.parse(cookieString);
        //Fill all the rows with the previous guesses in the table
        var guessesArray = wikipedleJsonCookie.guesses;
        guesses = guessesArray.length;
        guessesArray.forEach(function(item){
            insertNewTableRow(item.number, item.percent, item.linksInCommon, item.linksTotal, item.articleTitle, item.secretLinksToGuess, item.guessLinksToSecret);
        });

        if(wikipedleJsonCookie.win == true){
            win = true;
            //Increase guesses by 1 cause the winning guess is not entered into the table of guesses
            guesses++;
            displayWin();
        }

        if(wikipedleJsonCookie.givenUp == true){
            givenUp = true;
            displayGiveUp();
        }
    }
    
    increaseReadyCheck();
}

function insertRowToCookie(number, percent, linksInCommon, linksTotal, articleTitle, secretLinksToGuess, guessLinksToSecret){
    var cookieString = getWikipedleJsonObjectFromCookie();
    var jsonObject = {};

    if(cookieString != ''){
        jsonObject = JSON.parse(cookieString);
    } else {
        jsonObject = {};
        jsonObject.givenUp = false;
        jsonObject.win = false;
        jsonObject.guesses = [];
    }

    var rowObject = {};
    rowObject.number = number;
    rowObject.percent = percent;
    rowObject.linksInCommon = linksInCommon;
    rowObject.linksTotal = linksTotal;
    rowObject.articleTitle = articleTitle;
    rowObject.secretLinksToGuess = secretLinksToGuess;
    rowObject.guessLinksToSecret = guessLinksToSecret;

    jsonObject.guesses.push(rowObject);

    document.cookie = 'wikipedleObject=' + JSON.stringify(jsonObject) + ';expires=' + getEndOfDayString() + ';SameSite=Lax';
}

function insertWinToCookie(){
    var cookieString = getWikipedleJsonObjectFromCookie();
    var jsonObject = {};

    if(cookieString != ''){
        jsonObject = JSON.parse(cookieString);
    } else {
        jsonObject = {};
        jsonObject.givenUp = false;
        jsonObject.guesses = [];
    }

    jsonObject.win = true;

    document.cookie = 'wikipedleObject=' + JSON.stringify(jsonObject) + ';expires=' + getEndOfDayString() + ';SameSite=Lax';
}

function insertGiveUpToCookie(){
    var cookieString = getWikipedleJsonObjectFromCookie();
    var jsonObject = {};

    if(cookieString != ''){
        jsonObject = JSON.parse(cookieString);
    } else {
        jsonObject = {};
        jsonObject.win = false;
        jsonObject.guesses = [];
    }

    jsonObject.givenUp = true;

    document.cookie = 'wikipedleObject=' + JSON.stringify(jsonObject) + ';expires=' + getEndOfDayString() + ';SameSite=Lax';
}

function getEndOfDayString(){
    var date = new Date(); 
    var utcEndOfDay =  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59);

    return new Date(utcEndOfDay).toUTCString();
}

function getDayNumber(){
    var date = new Date();
    var utcNow = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getHours(), date.getMinutes(), date.getSeconds());
    var startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0, 0, 0, 1);
    var diff = utcNow - startOfYear;
    var oneDay = 1000 * 60 * 60 * 24;
    var day = Math.floor(diff / oneDay);
    return day - 63; //I start on the 64th day
}

function getArticleOfTheDay(puzzleNumber){
    var wordArray = ['Bacteria', 'Gravity', 'Bone', 'Lute', 'Prison', 'Sheep', 'Antarctica', 'Capacitor', 'Planetarium', 'Nile', 'Triceratops', 'Earthquake', 'Nitrogen', 'Cheese', 'Neutron', 'Greenland', 'Shark', 'Volcano', 'Graphite', 'Thor', 'Scotland', 'Strawberry', 'Neuron'];
    return wordArray[puzzleNumber - 1]; //-1 cause array start at 0
}

function preventReloadOnForm(){
    var form1 = document.getElementById('inputForm');
    form1.addEventListener('submit', function(event){
        event.preventDefault();
    });

    var form2 = document.getElementById('shareForm');
    form2.addEventListener('submit', function(event){
        event.preventDefault();
    });
}

function copyTextToClipboard(){
    var text = '';
    if(win || givenUp){
        if(win){
            text = 'I solved Wikipedle #' + puzzleNumber + ' in ' + guesses + ' guesses. https://woodmaninator.github.io/wikipedle/';
        }
        if(givenUp){
            text = 'I gave up on Wikipedle #' + puzzleNumber + ' after ' + guesses + ' guesses. https://woodmaninator.github.io/wikipedle/';
        }
        navigator.clipboard.writeText(text);
        console.log(text);
    }
}