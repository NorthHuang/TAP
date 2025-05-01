async function loadQuestions() {
    try {
      const res = await fetch("/api/get_questions");
      const data = await res.json();
  
      const container = document.querySelector("#questionTable tbody");
      container.innerHTML = "";
  
      data.forEach((q) => {
        const row = document.createElement("tr");
  
        row.innerHTML = `
          <td>
            <input type="text" class="desc" 
            style="width: 100%;
                height: 100px;
                font-size: 20px;
                "
            data-id="${q.question_id}" value="${q.description}" />
          </td>
          <td>
            <textarea class="options"
            style="width: 100%;
                height: 100px;
                font-size: 20px;"
            >${q.options.join("\n")}</textarea>
          </td>
          <td>
            <input type="text" class="answer"
            width: 15%;
    height: 15%;
    font-size: 20px;
            value="${q.answer}" />
          </td>
          <td>
            <button class="save-btn">Save</button>
            <button class="delete-btn">Delete</button>
          </td>
        `;
  
        container.appendChild(row);
      });
  
      // 保存按钮绑定事件
      document.querySelectorAll(".save-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const row = btn.closest("tr");
          const question_id = parseInt(row.querySelector(".desc").dataset.id);
          const description = row.querySelector(".desc").value.trim();
          const answer = row.querySelector(".answer").value.trim();
          const options = row.querySelector(".options").value
            .split("\n")
            .map(line => line.trim())
            .filter(line => line);
  
          const payload = { question_id, description, answer, options };
  
          const res = await fetch("/api/update_question", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
  
          const result = await res.json();
          alert(result.message || (result.success ? "保存成功！" : "保存失败"));
        });
      });

      document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const row = btn.closest("tr");
          const question_id = parseInt(row.querySelector(".desc").dataset.id);
      
          if (!confirm("delete this quesion？")) return;
      
          const res = await fetch("/api/delete_question", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question_id })
          });
      
          const result = await res.json();
          if (result.success) {
            row.remove(); // 从页面删除行
          } else {
            alert(result.message || "delete error");
          }
        });
      });
    } catch (err) {
      console.error("Error loading questions:", err);
    }
  }
  
  document.addEventListener("DOMContentLoaded", loadQuestions);
  