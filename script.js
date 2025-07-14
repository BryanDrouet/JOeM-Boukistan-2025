let players=[], mots=[], curr=0, word="", startTime, timerInt;
let maxGuesses=6, currRow=0;
let results=[], failed=[], usedWords = [];

async function loadWords(){
    const res=await fetch("mots.txt");
    mots=(await res.text()).trim().split("\n").map(w=>w.trim());
    mots=mots.filter(w=>w.length===5);
}

function startSetup(){
    const c=+document.getElementById("playerCount").value;
    if (!c || c < 1) return alert("Nombre de joueurs invalide.");
    document.getElementById("setup").style.display="none";
    let div=document.getElementById("player-names");
    div.innerHTML="<h1>Wordle Multijoueur</h1><label>Pseudos des joueurs :</label>";
    for(let i=0;i<c;i++) div.innerHTML+=`<div><input type="text" id="n${i}" placeholder="Joueur ${i+1}"><br><div>`;
    div.innerHTML+=`<button class="validateButton" onclick="validateNames(${c})">Commencer</button>`;
    div.style.display="grid";
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
                        // Aller à la case précédente si elle existe
                        if (c > 0) {
                            const prev = document.getElementsByClassName("row")[r].children[c - 1];
                            prev.focus();
                            prev.value = ""; // supprimer la lettre
                            e.preventDefault(); // éviter un backspace par défaut inutile
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
    document.getElementById("playerTurn").textContent="Au tour de : "+players[curr].name;
    buildGrid();
    startTime=Date.now();
    timerInt=setInterval(updateTimer,100);
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

    // Étape 1 : Marquer les lettres correctes
    for (let i = 0; i < 5; i++) {
        if (guessLetters[i] === targetLetters[i]) {
            result[i] = 'correct';
            targetLetters[i] = null; // Enlever la lettre du mot cible
        }
    }

    // Étape 2 : Marquer les lettres présentes
    for (let i = 0; i < 5; i++) {
        if (result[i] === 'correct') continue;
        const idx = targetLetters.indexOf(guessLetters[i]);
        if (idx !== -1) {
            result[i] = 'present';
            targetLetters[idx] = null;
        }
    }

    // Appliquer les couleurs et verrouiller les cases
    for (let i = 0; i < 5; i++) {
        rowEls[i].classList.add(result[i]);
        rowEls[i].disabled = true; // verrouiller la case
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
    players[curr].found=true;
    players[curr].time=(Date.now()-startTime)/1000;
    curr++;
    updateRanking();
    setTimeout(startTurn,500);
}

function lose(){
    clearInterval(timerInt);
    players[curr].found=false;
    players[curr].time=Infinity;
    curr++;
    updateRanking();
    setTimeout(startTurn,500);
}

function updateRanking(){
    const ol=document.getElementById("currentRanking");
    ol.innerHTML="";
    players.filter(p=>p.found).sort((a,b)=>a.time-b.time)
        .forEach(p=>ol.innerHTML+=`<li>${p.name} — ${p.time.toFixed(2)}s</li>`);
}

function showResults(){
    document.getElementById("game").style.display="none";
    document.getElementById("ranking").style.display="none";
    const d=document.getElementById("result");
    const win=players.filter(p=>p.found).sort((a,b)=>a.time-b.time);
    const lose=players.filter(p=>!p.found);
    let html="<h2>🏆 Résultat final</h2><ol>";
    win.forEach(p=>html+=`<li>${p.name} — ${p.time.toFixed(2)}s</li>`);
    html+="</ol>";
    if(lose.length){
        html+="<h3>❌ Non trouvés :</h3><ul>";
        lose.forEach(p=>html+=`<li>${p.name} (Mot : ${p.word})</li>`);
        html+="</ul>";
    }
    d.innerHTML=html; d.style.display="block";
    document.getElementById("ranking").style.display = "none";
}

function changePlayerCount(delta) {
    const input = document.getElementById("playerCount");
    let value = parseInt(input.value) || 1;
    value += delta;
    if (value < 1) value = 1;
    input.value = value;
}

loadWords();
