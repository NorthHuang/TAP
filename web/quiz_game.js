let questions = [];
let currentIndex = 0;

async function fetchQuestions() {
  const res = await fetch("/api/get_questions");
  questions = await res.json();
  shuffle(questions);
  showQuestion();
}

function showQuestion() {
  const container = document.getElementById("options");
  const q = questions[currentIndex];
  document.getElementById("question").textContent = q.description;
  container.innerHTML = "";

  const letters = ["A", "B", "C", "D"];
  const optionsWithIndex = q.options.map((text, i) => ({
    label: letters[i],
    text: text
  }));

  optionsWithIndex.forEach(({ label, text }) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = `${text}`;
    btn.onclick = () => {
      if (label === q.answer) {
        btn.style.backgroundColor = "#28a745"; // 绿色表示正确
        btn.disabled = true;
    
        // 禁用所有其他按钮
        document.querySelectorAll(".option-btn").forEach(b => b.disabled = true);
    
        setTimeout(() => {
          currentIndex++;
          if (currentIndex < questions.length) {
            showQuestion();
          } else {
            document.getElementById("question").textContent = "恭喜通关！🎉";
            container.innerHTML = "";
          }
        }, 1000); // 延迟 1 秒跳转
      } else {
        btn.classList.add("wrong");
        navigator.vibrate?.(200);
        setTimeout(() => btn.classList.remove("wrong"), 500);
      }
    };
    
    container.appendChild(btn);
  });
}


// 工具函数：打乱数组
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

document.addEventListener("DOMContentLoaded", fetchQuestions);
