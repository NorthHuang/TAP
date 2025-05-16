const MAX_FILE_SIZE_MB = 5;
const ALLOWED_TYPES = ['application/pdf', 'text/csv', 'image/png', 'image/jpeg', 'text/plain'];
function validateFile(file) {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    alert("The file is too large. The maximum allowed is 5MB.");
    return false;
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    alert("The file format is not supported, only pdf/csv/png/jpg/jpeg/txt are allowed!");
    return false;
  }
  return true;
}

async function loadUserProfile() {
  try {
    const res = await fetch("/api/get_profile");
    const data = await res.json();
    if (data.success) {
      if(data.profile.role){
        if(data.profile.role=="student"){
          document.getElementById("name").textContent = data.profile.name || "(Click to edit)";
          document.getElementById("gender").textContent = data.profile.gender || "(Click to edit)";
          document.getElementById("age").textContent = data.profile.age || "(Click to edit)";
          document.getElementById("level").value = data.profile.level || "primary";
          document.getElementById("sidebar").classList.remove("hidden");
          document.getElementById("questionButton").style.display = "none";
          document.getElementById("quizButton").style.display = "none";
          document.getElementById("upload_button").style.display = "none";
          document.getElementById("toggleUploadMode").style.display = "none";
        }else if(data.profile.role=="teacher"){
          document.getElementById("gender").parentNode.style.display = "none";
          document.getElementById("age").parentNode.style.display = "none";
          document.getElementById("level").parentNode.style.display = "none";
          document.getElementById("name").textContent = data.profile.name || "(Click to edit)";
          document.getElementById("sidebar").classList.remove("hidden");
        }
      }
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
function openQuestion(){
  window.open("/question_editor.html", "_blank");
}
function quizQuestion(){
  openIframePage("/quiz_game.html");
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
function loadQuizInterface() {
  const wrapper = document.getElementById("quiz-game-container");
  const quizFrame = document.getElementById("quizFrame");
  if(!quizFrame){
    // 创建做题 iframe
  const iframe = document.createElement("iframe");
  iframe.id = "quizFrame";
  iframe.src = "/quiz_game.html"; 
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  wrapper.appendChild(iframe);
  wrapper.style.display = "block";
  document.getElementById("closeQuizBtn").style.opacity=255;
  }
}
window.loadQuizInterface = loadQuizInterface;
function toggleGame() {
  const container = document.getElementById("game-container");
  const gameFrame = document.getElementById("gameFrame");
  if (!gameFrame) {
    const iframe = document.createElement("iframe");
    iframe.id = "gameFrame";
    iframe.src = "/static/QT/index.html";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    container.appendChild(iframe);
    container.style.display = "block";
    document.getElementById("closeGameBtn").style.opacity=255;
    // btn.textContent = "关闭游戏";
    // if (chat) chat.style.display = "none";
  } else {
    container.innerHTML = "";
    container.style.display = "none";
    // btn.textContent = "启动游戏";
    // if (chat) chat.style.display = "flex";
  }
}
window.toggleGame = toggleGame;
function addChatMessage(text) {
  const chat = document.getElementById("chat-log");
  const div = document.createElement("div");
  div.className = "chat-bubble";
  div.textContent = text;
  chat.prepend(div);
}
document.getElementById("closeQuizBtn").addEventListener("click", () => {
  const wrapper = document.getElementById("quiz-game-container");
  const quizFrame = document.getElementById("quizFrame");
  if (quizFrame) {
    wrapper.removeChild(quizFrame); 
    document.getElementById("closeQuizBtn").style.opacity=0;
  }
});

document.getElementById("closeGameBtn").addEventListener("click", () => {
  const wrapper = document.getElementById("game-container");
  const gameFrame = document.getElementById("gameFrame");
  if (gameFrame) {
    wrapper.removeChild(gameFrame);
    document.getElementById("closeGameBtn").style.opacity=0;
  }
});
document.getElementById("send_button").addEventListener("click", function () {
  const message = document.getElementById("message").value.trim();
  if (!message) return;
  if(pendingFile){
    if (!validateFile(pendingFile)) {
      pendingFile = null;
      return;
    }
    const formData = new FormData();
    formData.append('file', pendingFile);
    addChatMessage(`📄 ${pendingFile.name}`);
    upload_file(formData);
    pendingFile = null;
    document.getElementById("message").value = "";
    return;
  }else{
    if(uploadMode){
      upload_text(message);
      addChatMessage(message);
      document.getElementById("message").value = "";
    }else{
      addChatMessage(message);
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
  } 
}
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
document.getElementById("upload_button").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});
function sendTextToAI(text) {
  fetch('/human', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text,
      type: 'echo',
      interrupt: true,
      sessionid: parseInt(document.getElementById('sessionid').value || "0")
    })
  });
}
function upload_file(data){
  fetch('/api/upload_file', {
    method: 'POST',
    body: data
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // 上传成功，叫数字人说话
      sendTextToAI("File uploaded successfully");
    } else {
      // 上传失败，叫数字人说话
      // sendTextToAI("文件上传失败！");
    }
  })
  .catch(error => {
    console.error('上传出错:', error);
    // sendTextToAI("文件上传失败！");
  });
}
function upload_text(text){
  fetch('/api/upload_text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text,
      sessionid: parseInt(document.getElementById('sessionid').value || "0")
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // 上传成功，叫数字人说话
      sendTextToAI("Question uploaded successfully");
    } else {
      // 上传失败，叫数字人说话
      // sendTextToAI("文件上传失败！");
    }
  })
  .catch(error => {
    console.error('上传出错:', error);
    // sendTextToAI("文件上传失败！");
  });
}
function handleFileSelected() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  if (file) {
    if (!validateFile(file)) {
      return; 
    }
    const fileName = file.name;
    addChatMessage(`📄 ${fileName}`);
    // TODO
    // 新增上传逻辑
    const formData = new FormData();
    formData.append('file', file)
    upload_file(formData);
  }
}
enablePressToTalk('voice_button', function (text) {
  document.getElementById("message").value = text;
  document.getElementById("send_button").click();
});

window.addEventListener("DOMContentLoaded", async () => {
  await loadUserProfile()
  const shouldAutoStart = localStorage.getItem("autoStart") === "true";
  if (shouldAutoStart) {
    localStorage.removeItem("autoStart");
    start();
    setTimeout(() => {
      sendTextToAI("hello"); 
    }, 1000);
  }
});

let pendingFile = null;
let uploadMode = false; 
document.getElementById("message").addEventListener("paste", function(event) {
  const items = event.clipboardData?.items;
  if (!items) return;
  for (let item of items) {
    if (item.type.indexOf("image") !== -1) {
      const file = item.getAsFile();
      if (file) {
        pendingFile = file;  // 保存到临时变量
        document.getElementById("message").value = `📄 ${file.name}`;  // 把文件名显示到输入框
      }
    }
  }
});
document.getElementById("toggleUploadMode").addEventListener("click", () => {
  uploadMode = !uploadMode;
  const btn = document.getElementById("toggleUploadMode");
  btn.textContent = uploadMode ? "✅" : "📝";
});
