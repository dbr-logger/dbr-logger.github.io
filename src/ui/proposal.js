const GAS_URL =
  "https://script.google.com/macros/s/AKfycbwAqEgEmymWS0Ztge7CKinjSiEPW8gYvCnA_qk1qxjk-gLo1xjT4dBhrGkISHZeTKZR/exec";

const RECOMMEND_OPTIONS = [
  { value: "", label: "（選択）" },
  { value: "☆", label: "☆：強くおすすめできる" },
  { value: "◎", label: "◎：おすすめできる" },
  { value: "○", label: "○：やって損はしない" },
  { value: "△", label: "△：やるのもよい" },
  { value: "", label: "無記入：そうでもない" },
];

function todayFormatted() {
  const d = new Date();
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function findDifficultyEntry(difficultyTable, title) {
  return difficultyTable?.entries?.find((e) => e.title === title) ?? null;
}

async function postToGas(rowData) {
  const encodedData = encodeURIComponent(JSON.stringify({ data: rowData }));
  const params = new URLSearchParams();
  params.append("data", encodedData);

  const response = await fetch(GAS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function renderProposalButton(container, selectedSong, difficultyTable) {
  container.querySelector("#proposal-area")?.remove();

  if (!selectedSong || !difficultyTable) return;

  const entry = findDifficultyEntry(difficultyTable, selectedSong.title);
  if (!entry) return;

  const isProposed = selectedSong.isProposed ?? false;
  const isUnrated = !entry.level || entry.level === "";

  const area = document.createElement("div");
  area.id = "proposal-area";
  area.style.marginTop = "1rem";
  area.style.borderTop = "1px solid var(--color-border, #ddd)";
  area.style.paddingTop = "0.75rem";

  if (isProposed) {
    area.innerHTML = `
      <p style="font-size:0.875rem; color: var(--color-text-muted, #666);">
        ⚠️ 現在新規提案中の譜面です。<br>
        レベル・おすすめ度に違和感がある方は
        <a href="https://docs.google.com/spreadsheets/d/1R-bgS7CZ1BBTzsk4KRKRSmBAZWNotZnQLfWtZFQr-Ek/edit?gid=1709558806#gid=1709558806"
           target="_blank" rel="noopener" style="color:#0073e6;">
          新規提案シートの「異議申し立て」列
        </a>
        に記載してください。
      </p>`;
  } else if (isUnrated) {
    area.innerHTML = `<button class="button button-secondary proposal-open-btn" type="button" data-type="new">新規提案</button>`;
  } else {
    area.innerHTML = `
      <button class="button button-secondary proposal-open-btn" type="button" data-type="change">変更提案</button>
      <button class="button button-secondary proposal-open-btn" type="button" data-type="recommend" style="margin-left:0.5rem;">おすすめ提案</button>`;
  }

  const formContainer = document.createElement("div");
  formContainer.id = "proposal-form-container";
  area.appendChild(formContainer);
  container.appendChild(area);

  area.querySelectorAll(".proposal-open-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      if (formContainer.dataset.openType === type) {
        formContainer.innerHTML = "";
        formContainer.dataset.openType = "";
        return;
      }
      formContainer.dataset.openType = type;
      renderProposalForm(formContainer, type, entry);
    });
  });
}

function renderProposalForm(container, type, entry) {
  container.innerHTML = "";

  const today = todayFormatted();
  const typeLabel =
    type === "new" ? "新規提案" : type === "change" ? "変更提案" : "おすすめ提案";

  const formEl = document.createElement("form");
  formEl.style.marginTop = "1rem";
  formEl.style.padding = "0.75rem";
  formEl.style.background = "var(--color-surface-raised, #f5f5f5)";
  formEl.style.borderRadius = "0.375rem";
  formEl.style.fontSize = "0.9rem";

  formEl.innerHTML = `
    <b>【${typeLabel}フォーム】</b>
    <hr style="margin: 0.5rem 0;">
    ${buildFormFields(type, entry)}
    <div style="margin-top:0.75rem;">
      <button type="submit" class="button button-secondary">提案を送信</button>
      <button type="button" class="button proposal-cancel-btn" style="margin-left:0.5rem;">キャンセル</button>
    </div>
    <div class="proposal-status" style="margin-top:0.5rem; font-size:0.875rem;"></div>
  `;

  container.appendChild(formEl);


  formEl.querySelector(".proposal-cancel-btn").addEventListener("click", () => {
    container.innerHTML = "";
    container.dataset.openType = "";
  });

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    handleProposalSubmit(formEl, type, entry, today);
  });
}

function buildFormFields(type, entry) {
  const recommendOptions = RECOMMEND_OPTIONS.map(
    (o) => `<option value="${o.value}">${o.label}</option>`
  ).join("");

  if (type === "new") {
    return `
      <div style="margin-bottom:0.4rem;">
        <label>レベル（必須）: ☆<input name="level_new" required
          pattern="^[0-9]{1,2}\\.[0-9]{2}$" maxlength="5"
          title="小数点以下2桁（例: 11.00）" style="width:5ch; margin-left:0.25rem;"></label>
      </div>
      <div style="margin-bottom:0.4rem;">
        <label>おすすめ度（任意）:
          <select name="recommend_new" style="margin-left:0.25rem;">${recommendOptions}</select>
        </label>
      </div>
      <div style="margin-bottom:0.4rem;">
        <label>コメント（任意）:<br>
          <textarea name="comment_new" rows="3" style="width:100%; margin-top:0.25rem;"></textarea>
        </label>
        <small>※譜面傾向、攻略情報などなんでも（表に反映されます）</small>
      </div>
    `;
  }

  if (type === "change") {
    const currentLevel = entry.level ? entry.level.replace(/^[☆†]*[☆†]/, "") : "";
    return `
      <div style="margin-bottom:0.4rem;">
        現在のレベル: <b>☆${currentLevel}</b>
      </div>
      <div style="margin-bottom:0.4rem;">
        <label>変更後レベル（必須）: ☆<input name="level_change" required
          pattern="^[0-9]{1,2}\\.[0-9]{2}$" maxlength="5"
          title="小数点以下2桁（例: 11.00）" style="width:5ch; margin-left:0.25rem;"
          data-current="${currentLevel}"></label>
      </div>
      <div style="margin-bottom:0.4rem;">
        <label>提案理由（必須）:<br>
          <textarea name="reason_change" rows="3" required style="width:100%; margin-top:0.25rem;"></textarea>
        </label>
      </div>
    `;
  }

  return `
    <div style="margin-bottom:0.4rem;">
      現在のおすすめ度: <b>${entry.recommend || "無記入"}</b>
    </div>
    <div style="margin-bottom:0.4rem;">
      <label>変更後おすすめ度（必須）:
        <select name="recommend_change" required style="margin-left:0.25rem;">
          ${recommendOptions}
        </select>
      </label>
    </div>
    <div style="margin-bottom:0.4rem;">
      <label>提案理由（必須）:<br>
        <textarea name="reason_recommend" rows="3" required style="width:100%; margin-top:0.25rem;"></textarea>
      </label>
    </div>
  `;
}

async function handleProposalSubmit(formEl, type, entry, today) {
  const statusEl = formEl.querySelector(".proposal-status");
  const submitBtn = formEl.querySelector("[type=submit]");

  if (type === "change") {
    const levelInput = formEl.querySelector("[name=level_change]");
    if (levelInput.dataset.current && levelInput.value === levelInput.dataset.current) {
      alert("変更後のレベルが現在のレベルと一致しています。変更してください。");
      return;
    }
  }
  if (type === "recommend") {
    const newRecommend = formEl.querySelector("[name=recommend_change]")?.value;
    if (newRecommend === entry.recommend) {
      alert("変更後のおすすめ度が現在のおすすめ度と一致しています。変更してください。");
      return;
    }
  }

  if (!formEl.checkValidity()) {
    formEl.reportValidity();
    return;
  }

  submitBtn.disabled = true;
  statusEl.textContent = "送信中…";

  const fd = Object.fromEntries(new FormData(formEl).entries());

  let rowData;
  let sheetUrl;

  if (type === "new") {
    const infVal = entry.inf || "";
    const infPack = entry.infpack || "";

    rowData = [
      today,
      entry.ver || "",
      fd.level_new,
      entry.title,
      entry.video ?? "",
      entry.textageid ?? "",
      entry.notes ?? "",
      entry.scratch ?? "",
      entry.bpm ?? "",
      fd.recommend_new ?? "",
      infVal,
      entry.acdelete ? "○" : "",
      fd.comment_new ?? "",
      infPack,
      "new",
    ];
    sheetUrl = "https://docs.google.com/spreadsheets/d/1R-bgS7CZ1BBTzsk4KRKRSmBAZWNotZnQLfWtZFQr-Ek/edit?gid=1709558806#gid=1709558806";
  } else if (type === "change") {
    const currentLevel = entry.level ? entry.level.replace(/^[☆†]*[☆†]/, "") : "";
    rowData = [
      today,
      currentLevel,
      fd.level_change,
      entry.title,
      fd.reason_change,
      "change",
    ];
    sheetUrl = "https://docs.google.com/spreadsheets/d/1R-bgS7CZ1BBTzsk4KRKRSmBAZWNotZnQLfWtZFQr-Ek/edit?gid=1267054778#gid=1267054778";
  } else {
    rowData = [
      today,
      entry.recommend ?? "",
      fd.recommend_change,
      entry.title,
      fd.reason_recommend,
      "recommend",
    ];
    sheetUrl = "https://docs.google.com/spreadsheets/d/1R-bgS7CZ1BBTzsk4KRKRSmBAZWNotZnQLfWtZFQr-Ek/edit?gid=1779953087#gid=1779953087";
  }

  try {
    const result = await postToGas(rowData);
    if (result.result === "success") {
      const typeLabel = type === "new" ? "新規提案" : type === "change" ? "変更提案" : "おすすめ提案";
      alert(`${typeLabel}シートに遷移します。\n反映された内容をご確認ください。`);
      window.open(sheetUrl, "_blank", "noopener");
      const container = formEl.parentElement;
      container.innerHTML = "";
      container.dataset.openType = "";
    } else {
      statusEl.textContent = `送信に失敗しました: ${result.message ?? "不明なエラー"}`;
      submitBtn.disabled = false;
    }
  } catch (err) {
    console.error("提案送信エラー:", err);
    statusEl.textContent = "送信に失敗しました。時間をおいて再試行してください。";
    submitBtn.disabled = false;
  }
}
