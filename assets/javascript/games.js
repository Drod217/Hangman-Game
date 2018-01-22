
var quotes = ["Yada yada yada","Low Talker","Puffy Shirt","Not that there is anything wrong with that",
"Two face","Can't stand ya","Get out","Bizarro World","Double dipping","Hello Newman","Maybe the dingo ate your baby",
"I was in the pool","Shrinkage","Anti dentite","Close talker","Master of my domain","Bubble Boy","Mulva","The Soup Nazi",
"Re gifter","Manssiere","Serenity now","Man hands","In the vault","Sponge worthy","Giddy up","That's a shame","These pretzels are making me thirsty",
"Top of the muffin to you","Urban sombrero","High Talker","Vile weed","You are sooo good looking",
"They are real and they are spectacular","Festivus","Who is this"];

var alphabet = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", 
"q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];

var soundTag = ["bubble","cantstandya","contest","dingo","fakes","getdown","getout","giddyup",
"icare","idiot","jackass","machine","pirate","pretzels","rediculous"];

var sound2tag = ["reguifter","risk","serenity","society","switzerland","thebro","yada","youstink"];
var startMusic =["seinfeld"]

var userSelectedWord = [];
var selected;
var strings = "";
var choice;
var guessed = "";
var guessedArray = [];
var random;
var wins = 0;
var remaining = 10; 

document.onkeyup = function(event) {
	random = Math.floor(Math.random() * quotes.length);
	selected = quotes[random];
	document.getElementById("guessesRemaining").textContent = remaining;
	document.getElementById("wins").textContent = wins;

	for(var i = 0; i < selected.length; i++) {
		userSelectedWord.push(selected.charAt(i));
		if(alphabet.indexOf(selected.charAt(i).toLowerCase()) > -1)
			strings = strings.concat("_");
		else
			strings = strings.concat(selected.charAt(i));
	}

	document.getElementById("currentWord").textContent = strings;

	document.onkeyup = function(event) {
		choice = event.key;
		choice = choice.toLowerCase();

		if(alphabet.indexOf(choice) > -1) {
			if(guessedArray.indexOf(choice) > -1 && userSelectedWord.indexOf(choice) === -1 && userSelectedWord.indexOf(choice.toUpperCase()) === -1) {
				random = Math.floor(Math.random() * soundTag.length);
				document.getElementById(soundTag[random]).play();
			}
			else if(guessedArray.indexOf(choice) === -1 && userSelectedWord.indexOf(choice) === -1 && userSelectedWord.indexOf(choice.toUpperCase()) === -1) {
				remaining--;
				guessedArray.push(choice);
				document.getElementById("guessesRemaining").textContent = remaining;
				if(guessed.length === 0)
					guessed = guessed.concat(choice);
				else 
					guessed = guessed.concat(", ", choice);
				document.getElementById("lettersGuessed").textContent = guessed;
			}
			else {
				for(var j = 0; j < userSelectedWord.length; j++) {
					if(choice === userSelectedWord[j].toLowerCase())
						strings = strings.substr(0,j) + userSelectedWord[j] + strings.substr(j+1);
				}
				document.getElementById("currentWord").textContent = strings;
			}
		}
		
		if(strings.indexOf("_") === -1) {
			wins++;
			document.getElementById("wins").textContent = wins;
			random = Math.floor(Math.random() * sound2tag.length);
			document.getElementById(sound2tag[random]).play();
		}

		if(remaining === 0 || strings.indexOf("_") === -1) {
			remaining = 10;
			guessed = "";
			guessedArray = [];
			strings = "";
			userSelectedWord = [];

			random = Math.floor(Math.random() * quotes.length);
			selected = quotes[random];
			document.getElementById("guessesRemaining").textContent = remaining;
			document.getElementById("lettersGuessed").textContent = guessed;

			for(var i = 0; i < selected.length; i++) {
				userSelectedWord.push(selected.charAt(i));
				if(alphabet.indexOf(selected.charAt(i).toLowerCase()) > -1)
					strings = strings.concat("_");
				else
					strings = strings.concat(selected.charAt(i));
			}

			document.getElementById("currentWord").textContent = strings;
		}
	}
}