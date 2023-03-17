//Init SpeechSynth API
const synth = window.speechSynthesis;

// Dom elements
const textForm = document.querySelector("form");
const voiceSelect = document.querySelector("#voice-select");
const rate = document.querySelector("#rate");
const rateValue = document.querySelector("#rate-value");
const pitch = document.querySelector("#pitch");
const pitchValue = document.querySelector("#pitch-value");
const body = document.querySelector("body");

// Init voices array
let voices = [];

const getVoices = () => {
  voices = synth.getVoices();
  //   Loop through voices; create option for each voice
  voices.forEach(voice => {
    // Create option element
    const option = document.createElement("option");
    // Fill option with the voice and language
    option.textContent = voice.name + "(" + voice.lang + ")";
    // Set needed option attributes
    option.setAttribute("data-lang", "en-GB");
    option.setAttribute("data-name", "Shelley (English (UK))");
    voiceSelect.appendChild(option);
  });
};
getVoices();
if (synth.onvoiceschanged !== undefined) {
  synth.onvoiceschanged = getVoices;
}

//Speak
const speak = () => {
  // Check if speaking
  if (synth.speaking) {
    console.error("already speaking");
    return;
  }
  if (ai.value !== "") {
    //Add background animation if desired
    // body.style.background = "#141414 url(img/wave.gif)";
    // body.style.backgroundRepeat = "repeat-x";
    // body.style.backgroundSize = "100% 100%";
    //Get text to speak
    const speakText = new SpeechSynthesisUtterance(ai.value);
    //Speak end
    speakText.onend = e => {
      // body.style.background = "#141414";
    };
    //Speak error
    speakText.onerror = e => {
      console.error("Something went wrong...");
    };
    //Selected voice
    const selectedVoice = voiceSelect.selectedOptions[0].getAttribute("data-name");
  
    //Loop through the voices
    voices.forEach(voice => {
      if (voice.name === selectedVoice) {
        console.log(4444, voice)
        speakText.voice = voice;
      }
    });
    //Set pitch and rate
    speakText.rate = rate.value;
    speakText.pitch = pitch.value;
    //Speak
    synth.speak(speakText);
  }
};

//Event listeners

//Form submit
textForm.addEventListener("submit", e => {
  e.preventDefault();
  speak();
});

//Rate and pitch value change
rate.addEventListener("change", e => (rateValue.textContent = rate.value));
pitch.addEventListener("change", e => (pitchValue.textContent = pitch.value));

//Change on voice select
voiceSelect.addEventListener("change", e => speak());

// required dom elements
const buttonEl = document.getElementById('button');
const messageEl = document.getElementById('message');
const titleEl = document.getElementById('real-time-title');
const ai = document.getElementById('ai');
var msgToGpt = ""

async function runChatGpt(msg) {
  let sendDataToGpt = { msgToken: '9lnt3ubdtgindxeislbmw', msg: msg };
  const chapGptData = await fetch("https://be.chatsuggest.com/talkToGpt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sendDataToGpt),
  });
  let jsonData = await chapGptData.text();
  let tempData = JSON.parse(jsonData);
  ai.innerText = tempData.suggestedResponse
  speak()
  return tempData;
}

// set initial state of application variables
let isRecording = false;
let socket;
let recorder;

// runs real-time transcription and handles global variables
const run = async () => {
  if (isRecording) { 
    if (socket) {
      socket.send(JSON.stringify({terminate_session: true}));
      socket.close();
      socket = null;
    }

    if (recorder) {
      recorder.pauseRecording();
      recorder = null;
    }
  } else {
    const response = await fetch('https://be.chatsuggest.com/getAssemblyToken'); // get temp session token from server.js (backend)
    const data = await response.json();

    if(data.error){
      alert(data.error)
    }
    
    const { token } = data;

    // establish wss with AssemblyAI (AAI) at 16000 sample rate
    socket = await new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`);

    // handle incoming messages to display transcription to the DOM
    const texts = {};
    socket.onmessage = async (message) => {
      let msg = '';
      const res = JSON.parse(message.data);
      texts[res.audio_start] = res.text;
      const keys = Object.keys(texts);
      keys.sort((a, b) => a - b);
      for (const key of keys) {
        if (texts[key]) {
          msg += ` ${texts[key]}`;
        }
      }
      //messageEl.innerText = msg;
      msgToGpt  = msg
    };

    socket.onerror = (event) => {
      console.error(event);
      socket.close();
    }
    
    socket.onclose = event => {
      console.log(event);
      socket = null;
    }

    socket.onopen = () => {
      // once socket is open, begin recording
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          recorder = new RecordRTC(stream, {
            type: 'audio',
            mimeType: 'audio/webm;codecs=pcm', // endpoint requires 16bit PCM audio
            recorderType: StereoAudioRecorder,
            timeSlice: 250, // set 250 ms intervals of data that sends to AAI
            desiredSampRate: 16000,
            numberOfAudioChannels: 1, // real-time requires only one channel
            bufferSize: 4096,
            audioBitsPerSecond: 128000,
            ondataavailable: (blob) => {
              const reader = new FileReader();
              reader.onload = () => {
                const base64data = reader.result;

                // audio data must be sent as a base64 encoded string
                if (socket) {
                  socket.send(JSON.stringify({ audio_data: base64data.split('base64,')[1] }));
                }
              };
              reader.readAsDataURL(blob);
            },
          });

          recorder.startRecording();
        })
        .catch((err) => console.error(err));
    };
  }
  if(isRecording){
    runChatGpt(msgToGpt)
  }

  isRecording = !isRecording;
  buttonEl.innerText = isRecording ? 'Stop Recording' : ' Start Recording';
};

buttonEl.addEventListener('click', () => run());
