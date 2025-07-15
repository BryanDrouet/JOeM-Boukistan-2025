let startTime, timerInt, joemData;
let word="", gameMode = "multi";
let currentDelegation = null;
let curr=0, maxGuesses=6, currRow=0, hintsRemaining = 0; hintIndex = 0;
let players=[], mots=[], hintList = [], results=[], failed=[], usedWords = [], currentWords = [];

const toggleBtn = document.getElementById('toggleRules');
const rules = document.getElementById('rules');

async function loginJOEM() {
  const name = document.getElementById("joem-delegation").value.trim();
  const pass = document.getElementById("joem-password").value;

  const res = await fetch("delegations.json");
  const delegations = await res.json();
  const entry = delegations.find(d => d.delegation.toLowerCase() === name.toLowerCase());

  if (!entry) return alert("Délégation introuvable.");

  const passOk = await bcrypt.compare(pass, entry.password);
  if (!passOk) return alert("Mot de passe incorrect.");

  currentDelegation = entry.delegation;
  currentWords = entry.words;

  document.getElementById("joem-login").style.display = "none";

  const wordDiv = document.getElementById("joem-word-choice");
  wordDiv.innerHTML = `
    <h2>${entry.delegation}</h2>
    <p>Choisis un des deux mots secrets :</p>
    <button onclick="startJOEMGame(0)">Mot 1</button>
    <button onclick="startJOEMGame(1)">Mot 2</button>
  `;
  wordDiv.style.display = "block";
}

function startJOEMGame(index) {
  const hashedWord = currentWords[index];
  players = [{ name: currentDelegation, word: hashedWord, time: 0, found: false }];
  document.getElementById("joem-word-choice").style.display = "none";
  document.getElementById("setup").style.display = "none";
  startTurn();
}

async function onGameModeChange() {
    const mode = document.getElementById("gameMode").value;
    document.getElementById("playerCountContainer").style.display = (mode === "multi") ? "block" : "none";
    document.getElementById("joem-login").style.display = (mode === "joem") ? "grid" : "none";
    document.getElementById("setup").style.display = (mode === "joem") ? "none" : "block";
}

async function showEncryptPrompt() {
    const mot = prompt("Entre un texte à crypter :");

    const crypto = await getCrypto();
    const hash = await crypto.hash(mot);
    alert(`Mot hashé avec bcrypt :\n${hash}`);
}

async function loginDelegation() {
    const delegation = document.getElementById("delegation").value.trim();
    const password = document.getElementById("password").value;
    if (!delegation || !password) return alert("Remplis tous les champs.");

    const res = await fetch("delegations.json");
    joemData = await res.json();

    const entry = joemData.find(d => d.delegation === delegation);
    if (!entry) return alert("Délégation inconnue.");

    if (password !== entry.password) return alert("Mot de passe incorrect.");

    document.getElementById("joem-login").style.display = "none";
    document.getElementById("joem-word-choice").style.display = "grid";
    document.getElementById("word1Btn").textContent = `Mot 1`;
    document.getElementById("word2Btn").textContent = `Mot 2`;
    document.getElementById("word1Btn").dataset.word = entry.word1;
    document.getElementById("word2Btn").dataset.word = entry.word2;
}

function chooseJoemWord(index) {
    const btn = document.getElementById(index === 1 ? "word1Btn" : "word2Btn");
    const hashedWord = btn.dataset.word;

    players = [{
        name: document.getElementById("delegation").value,
        word: hashedWord,
        time: 0,
        found: false
    }];

    document.getElementById("joem-word-choice").style.display = "none";
    document.getElementById("game").style.display = "block";
    startTurn();
}

function getCrypto() {
    return {
        async encode(clear) {
            return btoa(clear); 
        },
        async decode(base64) {
            return atob(base64); 
        },
        async hash(clear) {
            const salt = await bcrypt.genSalt(10);
            return await bcrypt.hash(clear, salt);
        },
        async verify(input, hashed) {
            return await bcrypt.compare(input, hashed);
        }
    };
}

async function loadWords(){
    const res=await fetch("mots.txt");
    mots=(await res.text()).trim().split("\n").map(w=>w.trim());
    mots=mots.filter(w=>w.length===5);
}

function startSetup(){
    const mode = document.getElementById("gameMode").value;
    gameMode = document.getElementById("gameMode").value;

    let count = parseInt(document.getElementById("playerCount").value);
    if (isNaN(count) || count < 2) {
        count = 2;
        document.getElementById("playerCount").value = 2;
    }

    if (mode === "solo" || mode === "train") {
        players = [{ name: "Joueur", word: "", time: 0, found: false }];
        mots.sort(() => Math.random() - 0.5);
        players[0].word = mots[0];
        document.getElementById("setup").style.display = "none";
        startTurn();
        return;
    }

    const c = +document.getElementById("playerCount").value;
    if (!c || c < 1) return alert("Nombre de joueurs invalide.");
    document.getElementById("setup").style.display = "none";
    let div = document.getElementById("player-names");
    div.innerHTML = "<h1>Wordle Multijoueur</h1><label>Pseudos des joueurs :</label><br>";
    for (let i = 0; i < c; i++) div.innerHTML += `<div><input type="text" id="n${i}" placeholder="Joueur ${i + 1}"><br><div>`;
    div.innerHTML += `<br><button class="validateButton" onclick="validateNames(${c})">Commencer</button>`;
    div.style.display = "grid";
}

function validateNames(n){
    for(let i=0;i<n;i++){
        let nm=document.getElementById("n"+i).value.trim();
        if(!nm) return alert("Remplis tous les noms.");
        players.push({name:nm, word:"", time:0, found:false});
    }
    if (players.length > mots.length) {
        alert("Attention : il n'y a pas assez de mots différents pour chaque joueur !");
    }
    mots.sort(()=>Math.random()-0.5);
    players.forEach((p,i)=>p.word=mots[i]);
    document.getElementById("player-names").style.display="none";
    startTurn();
}

function buildGrid(){
    const g=document.getElementById("grid");
    g.innerHTML="";
    for(let r=0;r<maxGuesses;r++){
        const row=document.createElement("div"); row.className="row";
        for(let c=0;c<5;c++){
            const inp=document.createElement("input");
            inp.className="tile"; inp.maxLength=1;
            inp.disabled = r!==0;
            inp.addEventListener("input", ()=>{ if(inp.value) moveFocus(r,c+1); });
            inp.addEventListener("keydown", e => {
                if (e.key === "Enter" && r === currRow) {
                    checkGuess();
                } else if (e.key === "Backspace" && r === currRow) {
                    if (!inp.value) {
                        if (c > 0) {
                            const prev = document.getElementsByClassName("row")[r].children[c - 1];
                            prev.focus();
                            prev.value = ""; 
                            e.preventDefault(); 
                        }
                    }
                }
            });
            row.appendChild(inp);
        }
        g.appendChild(row);
    }
}

function moveFocus(r,c){
    if(c<5) document.getElementsByClassName("row")[r].children[c].focus();
}

function startTurn(){
    usedWords = [];
    if(curr>=players.length) return showResults();
    word=players[curr].word;
    currRow=0;
    document.getElementById("game").style.display="block";
    if (gameMode === "multi") {
        document.getElementById("playerTurn").textContent = "Au tour de : " + players[curr].name;
        document.getElementById("playerTurn").style.display = "block";
    } else {
        document.getElementById("playerTurn").textContent = "";
        document.getElementById("playerTurn").style.display = "none";
    }
    
    buildGrid();
    document.querySelector(".row input")?.focus();
    startTime=Date.now();
    timerInt=setInterval(updateTimer,100);
    if (gameMode === "train") {
        prepareHints();
        document.getElementById("hintButton").style.display = "block";
        hintIndex = 0;
    }
    else {
        document.getElementById("hintButton").style.display = "none";
    }
}

function prepareHints() {
    let w = word.toLowerCase().split("");
    let hint1 = Math.floor(Math.random() * 5);
    let hint2;
    do {
        hint2 = Math.floor(Math.random() * 5);
    } while (hint2 === hint1);

    hintList = [
        `🧠 Indice 1 : La lettre "${w[hint1].toUpperCase()}" est bien placée à la position ${hint1 + 1}.`,
        `🧠 Indice 2 : La lettre "${w[hint2].toUpperCase()}" est dans le mot, mais pas à sa place.`
    ];
}

function showNextHint() {
    if (hintIndex < hintList.length) {
        alert(hintList[hintIndex]);
        hintIndex++;
        if (hintIndex >= hintList.length) {
            document.getElementById("hintButton").style.display = "none";
        }
    }
}

function showHints() {
    let w = word.toLowerCase().split("");
    let hint1 = Math.floor(Math.random() * 5);
    let hint2;
    do {
        hint2 = Math.floor(Math.random() * 5);
    } while (hint2 === hint1);

    let letterInWord = w[hint1];
    let letterElsewhere = w[hint2];

    alert(`🧠 Indices :
- La lettre "${letterInWord.toUpperCase()}" est bien placée à la position ${hint1 + 1}.
- La lettre "${letterElsewhere.toUpperCase()}" est dans le mot, mais pas à sa place.`);
}

function updateTimer(){
    document.getElementById("timer").textContent=`⏱️ ${((Date.now()-startTime)/1000).toFixed(2)}s`;
}

function checkGuess() {
    const rowEls = document.getElementsByClassName("row")[currRow].children;
    const guess = [...rowEls].map(i => i.value.toLowerCase()).join("");

    if (guess.length < 5) return;

    if (usedWords.includes(guess)) {
        document.getElementById("message").textContent = "Mot déjà tenté !";
        return;
    }

    usedWords.push(guess);

    const guessLetters = guess.split('');
    const targetLetters = word.toLowerCase().split('');
    const result = Array(5).fill('absent');

    for (let i = 0; i < 5; i++) {
        if (guessLetters[i] === targetLetters[i]) {
            result[i] = 'correct';
            targetLetters[i] = null; 
        }
    }

    for (let i = 0; i < 5; i++) {
        if (result[i] === 'correct') continue;
        const idx = targetLetters.indexOf(guessLetters[i]);
        if (idx !== -1) {
            result[i] = 'present';
            targetLetters[idx] = null;
        }
    }

    for (let i = 0; i < 5; i++) {
        rowEls[i].classList.add(result[i]);
        rowEls[i].disabled = true; 
    }

    document.getElementById("message").textContent = "";

    if (guess === word.toLowerCase()) {
        win();
    } else {
        currRow++;
        if (currRow < maxGuesses) {
            const nextRow = document.getElementsByClassName("row")[currRow].children;
            [...nextRow].forEach(inp => inp.disabled = false);
            nextRow[0].focus();
        } else {
            lose();
        }
    }
}

function win(){
    clearInterval(timerInt);
    players[curr].found = true;
    players[curr].time = (Date.now() - startTime) / 1000;
    curr++;
    setTimeout(startTurn, 500);
}

function lose(){
    clearInterval(timerInt);
    players[curr].found = false;

    const lastGuess = [...document.getElementsByClassName("row")[currRow - 1].children]
        .map(i => i.value.toLowerCase());

    let correctLetters = 0;
    for (let i = 0; i < 5; i++) {
        if (lastGuess[i] === players[curr].word[i].toLowerCase()) correctLetters++;
    }

    players[curr].correctLetters = correctLetters;
    curr++;
    setTimeout(startTurn, 500);
}

function showResults() {
    document.getElementById("game").style.display = "none";
    document.getElementById("rules").style.display = "none";
    const d = document.getElementById("result");
    let html = "<h2>📝 Résultats finaux</h2><ul>";

    players.forEach(p => {
        if (p.found) {
            html += `<li>${p.name} — trouvé en ${p.time.toFixed(2)}s</li>`;
        } else {
            html += `<li>${p.name} — ${p.correctLetters || 0}/5 lettres bien placées (Mot : ${p.word})</li>`;
        }
    });

    html += "</ul>";
    d.innerHTML = html;
    d.style.display = "block";
}

function changePlayerCount(delta) {
    const input = document.getElementById("playerCount");
    let value = parseInt(input.value) || 1;
    value += delta;
    if (value < 1) value = 1;
    input.value = value;
}

function changePlayerCount(change) {
    const input = document.getElementById('playerCount');
    const minusBtn = document.getElementById('minusBtn');
    let value = parseInt(input.value) + change;

    if (value < 2) value = 2;
    input.value = value;

    if (value <= 2) {
        minusBtn.classList.add("disabled");
    } else {
        minusBtn.classList.remove("disabled");
    }
}

document.getElementById("playerCount").addEventListener("input", function () {
    let val = parseFloat(this.value);
    if (isNaN(val) || val < 2 || !Number.isInteger(val)) {
        this.value = 2;
    }
});

function restartGame() {
    if (confirm("Cette action va recommencer une nouvelle partie depuis le début.\nToutes les données actuelles seront perdues.\n\nVoulez-vous vraiment recommencer ?")) {
        location.reload();
    }
}

function toggleRules() {
    const rules = document.getElementById("rules");
    const btn = document.getElementById("toggleRules");
    if (rules.style.display === "none") {
        rules.style.display = "block";
        btn.textContent = "Masquer le tuto";
    } else {
        rules.style.display = "none";
        btn.textContent = "Afficher le tuto";
    }
}

toggleBtn.addEventListener('click', () => {
    if (rules.style.display === 'none') {
        rules.style.display = 'block';
    } else {
        rules.style.display = 'none';
    }
});

if (window.innerWidth < 768) {
    rules.style.display = 'none';
}

window.onload = () => {
    changePlayerCount(0); 
};

loadWords();
