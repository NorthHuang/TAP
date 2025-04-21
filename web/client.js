let pc = null;
let ws = null;
let gptBubble = null; // 当前数字人回复气泡

function addGptChatBubble(text) {
  const chat = document.getElementById("chat-log");
  if (!gptBubble) {
    gptBubble = document.createElement("div");
    gptBubble.className = "chat-bubble";
    gptBubble.style.backgroundColor = "#d0d0ff"; // 淡蓝色代表数字人
    chat.prepend(gptBubble);
  }
  gptBubble.textContent = text;
}

function finalizeGptBubble(text) {
  if (gptBubble) {
    gptBubble.textContent = text;
    gptBubble = null;
  }
}

function setupWebSocket(sessionid) {
  ws = new WebSocket("wss://swintapai.com/ws?sessionid=" + sessionid);
  ws.onopen = () => console.log("WebSocket connected");
  ws.onerror = (e) => console.error("WebSocket error:", e);
  ws.onclose = () => console.log("WebSocket closed");

  ws.onmessage = function (event) {
    console.log("[WebSocket] Message received:", event.data);
    const data = JSON.parse(event.data);
    if (data.type === "gpt_stream") {
      addGptChatBubble(data.text);
    } else if (data.type === "gpt_end") {
      finalizeGptBubble(data.text);
      //启动游戏
      if(data.start_game){
        setTimeout(() => {
          console.log("✅ 现在启动游戏！");
          if (typeof window.toggleGame === "function") {
            window.toggleGame();
          }
        }, 3000);
      }
    }
  };
}

function negotiate() {
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });
  return pc.createOffer().then((offer) => {
    return pc.setLocalDescription(offer);
  }).then(() => {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkState);
      }
    });
  }).then(() => {
    const offer = pc.localDescription;
    return fetch('/offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp: offer.sdp, type: offer.type })
    });
  }).then((response) => response.json()).then((answer) => {
    document.getElementById('sessionid').value = answer.sessionid;
    setupWebSocket(answer.sessionid);  // ✅ 初始化 WebSocket
    return pc.setRemoteDescription(answer);
  }).catch((e) => {
    alert(e);
  });
}

function start() {
  const config = {
    sdpSemantics: 'unified-plan'
  };
  // if (document.getElementById("use-stun")?.checked) {
  //   config.iceServers = [{ urls: ['stun:stun.l.google.com:19302'] }];
  // }

  pc = new RTCPeerConnection(config);

  pc.addEventListener('track', (evt) => {
    if (evt.track.kind === 'video') {
      document.getElementById('video').srcObject = evt.streams[0];
    } else {
      document.getElementById('audio').srcObject = evt.streams[0];
    }
  });

  // document.getElementById('start').style.display = 'none';
  negotiate();
}

window.onunload = window.onbeforeunload = function () {
  setTimeout(() => pc?.close(), 500);
  return '关闭提示';
};
