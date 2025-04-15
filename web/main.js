async function loadUserProfile() {
    try {
      const res = await fetch("/api/get_profile");
      const data = await res.json();
      if (data.success) {
        document.getElementById("name").textContent = data.profile.name || "(Click to edit)";
        document.getElementById("gender").textContent = data.profile.gender || "(Click to edit)";
        document.getElementById("age").textContent = data.profile.age || "(Click to edit)";
        document.getElementById("level").value = data.profile.level || "primary";
        document.getElementById("sidebar").classList.remove("hidden");
      } else {
        console.warn("Not logged in or failed to fetch profile.");
      }
    } catch (err) {
      console.error("Error loading user profile:", err);
    }
  }
  
  function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("hidden");
  }
  
  let editedProfile = {};
  
  function editField(field) {
    const span = document.getElementById(field);
    const currentValue = span.textContent;
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentValue.includes("Click to edit") ? "" : currentValue;
    input.onblur = () => {
      span.textContent = input.value || "(Click to edit)";
      editedProfile[field] = input.value;
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') input.blur();
    };
    span.textContent = "";
    span.appendChild(input);
    input.focus();
  }
  
  function saveProfile() {
    const name = document.getElementById("name").textContent;
    const gender = document.getElementById("gender").textContent;
    const age = document.getElementById("age").textContent;
    const level = document.getElementById("level").value;
  
    const updates = [
      { field: "name", value: name },
      { field: "gender", value: gender },
      { field: "age", value: age },
      { field: "level", value: level }
    ];
    Promise.all(updates.map(({ field, value }) => {
      return fetch('/api/update_profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value })
      }).then(res => res.json());
    })).then(results => {
      const failed = results.find(r => !r.success);
      if (failed) {
        alert("Some updates failed");
      } else {
        alert("Profile updated successfully");
        editedProfile = {};
      }
    });
  }
  
  function logout() {
    fetch('/api/logout', { method: 'POST' }).then(() => {
      localStorage.removeItem("autoStart");
      window.location.href = 'index.html';
    });
  }
  
  function toggleGame() {
    const wrapper = document.getElementById("gameFrameWrapper");
    const btn = document.getElementById("toggleGameBtn");
    const chat = document.getElementById("chat-log");
    if (!wrapper.hasChildNodes()) {
      const iframe = document.createElement("iframe");
      iframe.id = "gameFrame";
      iframe.src = "/static/QT/index.html";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      wrapper.appendChild(iframe);
  
      wrapper.style.display = "block";
      btn.textContent = "关闭游戏";
      if (chat) chat.style.display = "none";
    } else {
      wrapper.innerHTML = "";
      wrapper.style.display = "none";
      btn.textContent = "启动游戏";
      if (chat) chat.style.display = "flex";
    }
  }
  
  function addChatMessage(text) {
    const chat = document.getElementById("chat-log");
    const div = document.createElement("div");
    div.className = "chat-bubble";
    div.textContent = text;
    chat.prepend(div);
  }
  
  document.getElementById("send_button").addEventListener("click", function () {
    const message = document.getElementById("message").value.trim();
    if (!message) return;
  
    addChatMessage("我：" + message);
  
    fetch('/human', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        type: 'echo',
        interrupt: true,
        sessionid: parseInt(document.getElementById('sessionid').value || "0")
      })
    });
  
    document.getElementById("message").value = "";
  });
  
  function enablePressToTalk(buttonId, onResult) {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Browser does not support speech recognition');
      return;
    }
  
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'zh-CN';
  
    let isRecording = false;
  
    recognition.onresult = function (event) {
      const transcript = event.results[0][0].transcript;
      if (onResult) onResult(transcript);
    };
  
    recognition.onerror = function (event) {
      console.error('Speech recognition error:', event.error);
    };
  
    recognition.onend = function () {
      isRecording = false;
      const btn = document.getElementById(buttonId);
      btn.classList.remove("recording");
      btn.textContent = '🎤';
    };
  
    const btn = document.getElementById(buttonId);
    btn.addEventListener('mousedown', () => {
      if (!isRecording) {
        recognition.start();
        isRecording = true;
        btn.classList.add("recording");
        btn.textContent = '⏹';
      }
    });
  
    btn.addEventListener('mouseup', () => {
      if (isRecording) recognition.stop();
    });
  
    btn.addEventListener('touchstart', () => {
      if (!isRecording) {
        recognition.start();
        isRecording = true;
        btn.classList.add("recording");
        btn.textContent = '⏹';
      }
    });
  
    btn.addEventListener('touchend', () => {
      if (isRecording) recognition.stop();
    });
  }
  
  enablePressToTalk('voice_button', function (text) {
    document.getElementById("message").value = text;
    document.getElementById("send_button").click();
  });
  
  window.addEventListener("DOMContentLoaded", async () => {
    await loadUserProfile();
  
    const shouldAutoStart = localStorage.getItem("autoStart") === "true";
    if (shouldAutoStart) {
      localStorage.removeItem("autoStart");
      start();
    }
  });
  