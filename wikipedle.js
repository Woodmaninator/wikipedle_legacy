var guesses = 0;
var ready = 0;
var secret = {};
secret.title = "Lilith";
secret.linksInArticle = new Array();
secret.linksToArticle = new Array();

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
    if(ready == 2){
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
            secret.linksInArticle.push(item.title);
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
    setInputDisabled(true);
    var guessedArticle = document.getElementById('inputTextBox').value;
    guesses++;
    if(guessedArticle != ''){
        if(guessedArticle.toUpperCase() == secret.title.toUpperCase()){
            displayWin();
            //TODO
            //Insert win into cookie
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
            if(secret.linksInArticle.includes(item.title)){
                linksInCommon++;
            }
            linksTotal++;
            if(!guessLinksToSecret){
                if (item.title == secret.title){
                    guessLinksToSecret = true;
                }
            }
        }
    });

    if(!secretLinksToGuess){
        if(secret.linksInArticle.includes(guessedArticle)){
            secretLinksToGuess = true;
        }
    }

    if (responseObject.hasOwnProperty('continue')){
        httpGetAsyncAndTrackGuesses('https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&prop=links&titles=' + guessedArticle + '&pllimit=500&plcontinue=' + responseObject.continue.plcontinue, guessCallBack, linksInCommon, linksTotal, secretLinksToGuess, guessLinksToSecret);
    } else {
        if(linksTotal < 30){
            guesses--;
            updateStatusText('Not enough links','Your guess has less than 30 links on the page which means that it is either just an article that redirects to other articles or the article is insignificant.');
            setInputDisabled(false);
        } else {
            completeGuess(linksInCommon, linksTotal, secretLinksToGuess, guessLinksToSecret);
        }
    }
}

function completeGuess(linksInCommon, linksTotal, secretLinksToGuess, guessLinksToSecret){
    var percent = 0;
    var guessLinksToSecretText = '';
    var secretLinksToGuessText = '';

    if(guessLinksToSecret)
        guessLinksToSecretText = 'Your guess LINKS to the secret article!';
    else
        guessLinksToSecretText = 'Your guess does not link to the secret article.';

    if(secretLinksToGuess)
        secretLinksToGuessText = 'The secret article LINKS to the guessed article!';
    else
        secretLinksToGuessText = 'The secret article does not link to the guessed article';

    if(linksTotal != 0)
        percent = Math.round(linksInCommon / linksTotal * 100);

    updateStatusText('Last Guess: ' + document.getElementById('inputTextBox').value, 'You guess has ' + percent + '% (' + linksInCommon + '/' + linksTotal + ') of links on the article in common with the secret article.<br>'+guessLinksToSecretText+'<br>'+secretLinksToGuessText);

    //TODO: Put new table row into table of previous guesses
    insertNewTableRow(percent, linksInCommon, linksTotal, secretLinksToGuess, guessLinksToSecret);

    setInputDisabled(false);
}

function updateStatusText(header, text){
    document.getElementById('statusHeader').innerHTML = header;
    document.getElementById('statusText').innerHTML = text;
}

function updateSecretText(){
    document.getElementById('secretInfoText').innerHTML = 'The secret article has ' + secret.linksInArticle.length + ' links on the article.<br>There are ' + secret.linksToArticle.length + ' articles that point to the secret article.';
}

function displayWin(){
    updateStatusText('You win!', 'The secret article was ' + secret.title + '. You guessed it after ' + guesses + ' guesses.');
}

function setInputDisabled(value){
    document.getElementById('guessButton').disabled = value;
    document.getElementById('inputTextBox').disabled = value;
    document.getElementById('giveUpButton').disabled = value;
    //Also clear the input of the textBox if disabled is set to false
    if(value == false)
        document.getElementById('inputTextBox').value = '';
}

function insertNewTableRow(percent, linksInCommon, linksTotal, secretLinksToGuess, guessLinksToSecret){
    var index = 0;
    var tableBody = document.getElementById('tableBody');
    var currentRows = tableBody.children;
    var newRow;

    if(currentRows.length >= 1){
        console.log(index);
        while (index < currentRows.length && currentRows[index].children[0].innerHTML.substring(0, currentRows[index].children[0].innerHTML.indexOf('%')) > percent){
            index++;  
        }
        newRow = tableBody.insertRow(index);
    } else {
        console.log('Length is 0');
        newRow = tableBody.insertRow(-1);
    }
    
    var tdPercent = document.createElement('td');
    tdPercent.innerHTML = percent + '% (' + linksInCommon + '/' + linksTotal + ')';
    newRow.appendChild(tdPercent);

    var tdGuess = document.createElement('td');
    tdGuess.innerHTML = document.getElementById('inputTextBox').value;
    newRow.appendChild(tdGuess);

    var tdSecretLinksToGuess = document.createElement('td');
    if(secretLinksToGuess)
        tdSecretLinksToGuess.innerHTML = '&#10004';
    else
        tdSecretLinksToGuess.innerHTML = '&#10006'
    newRow.appendChild(tdSecretLinksToGuess);

    var tdGuessLinksToSecret = document.createElement('td');
    if(guessLinksToSecret)
        tdGuessLinksToSecret.innerHTML = '&#10004';
    else
        tdGuessLinksToSecret.innerHTML = '&#10006'
    newRow.appendChild(tdGuessLinksToSecret);
}
function giveUp(){
    if (confirm('Are you sure that you want to give up?')) {
        updateStatusText(':(', 'You gave up after ' + guesses + " guesses. The secret word was " + secret.title + '.');
        setInputDisabled(true);
      } 
}

function increaseReadyCheck(){
    ready++;
    if(ready == 3){
        updateSecretText();
        setInputDisabled(false);
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
            insertNewTableRow(item.percent, item.linksInCommon, item.linksTotal, item.secretLinksToGuess, item.guessLinksToSecret);
        });

        if(wikipedleJsonCookie.win == true){
            //TODO
            //Problem: if i disable the input boxes here, after the ready check they will just be activated again
            //Therefore another variable has to be introduced that tracks whether the game is already won, in the redy check the input boxes are only enabled if win == false
            //The inputs do not have to be explicitly disabled here because they already are disabled at this point in the code.
        }
    }
    
    increaseReadyCheck();
}

function insertRowToCookie(){
    var cookieString = getWikipedleJsonObjectFromCookie();
}

function insertWinToCookie(){
    var cookieString = getWikipedleJsonObjectFromCookie();
}