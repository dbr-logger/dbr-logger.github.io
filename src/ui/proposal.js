import { formatIsoDate, todayIso } from "../utils/date.js";
import { escapeHtml } from "../utils/html.js";

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
const NEW_PROPOSAL_DUPLICATE_ERROR =
  "Error: 既に同曲、同譜面に対しての提案が存在します。管理用スプレッドシートをご確認ください。提案内容に対して異議がある場合、異議申し立て列に記載してください。";
const NEW_PROPOSAL_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1R-bgS7CZ1BBTzsk4KRKRSmBAZWNotZnQLfWtZFQr-Ek/edit?gid=1709558806#gid=1709558806";

function todayFormatted() {
  return formatIsoDate(todayIso());
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
  area.className = "proposal-area";

  if (isProposed) {
    area.innerHTML = `
      <p class="proposal-warning">
        ⚠️ 現在、新規提案中の譜面です。<br>
        レベル・おすすめ度に違和感がある場合は、<a class="proposal-link" href="https://docs.google.com/spreadsheets/d/1R-bgS7CZ1BBTzsk4KRKRSmBAZWNotZnQLfWtZFQr-Ek/edit?gid=1709558806#gid=1709558806" target="_blank" rel="noopener">新規提案シート</a>の「異議申し立て」列に記載することができます（外部スプレッドシートを開きます）。
      </p>`;
  } else if (isUnrated) {
    area.innerHTML = `<div class="proposal-open-actions"><button class="button button-secondary proposal-open-btn proposal-action-btn" type="button" data-type="new">新規提案</button></div>`;
  } else {
    area.innerHTML = `
      <div class="action-group proposal-open-actions">
        <button class="button button-secondary proposal-open-btn proposal-action-btn" type="button" data-type="change">変更提案</button>
        <button class="button button-secondary proposal-open-btn proposal-action-btn" type="button" data-type="recommend">おすすめ提案</button>
      </div>`;
  }

  const formContainer = document.createElement("div");
  formContainer.id = "proposal-form-container";
  formContainer.className = "proposal-form-container";
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
  formEl.className = "proposal-form";

  formEl.innerHTML = `
    <div class="proposal-form-title">${typeLabel}フォーム</div>
    <hr class="proposal-divider">
    <div class="proposal-form-body">
      ${buildFormFields(type, entry)}
    </div>
    <div class="action-group proposal-form-actions">
      <button type="button" class="button button-primary proposal-submit-btn">送信</button>
      <button type="button" class="button button-tertiary proposal-cancel-btn">キャンセル</button>
    </div>
    <div class="proposal-status"></div>
  `;

  container.appendChild(formEl);


  formEl.querySelector(".proposal-cancel-btn").addEventListener("click", () => {
    container.innerHTML = "";
    container.dataset.openType = "";
  });

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
  });

  formEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target instanceof HTMLElement && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  });

  formEl.querySelector(".proposal-submit-btn").addEventListener("click", () => {
    handleProposalSubmit(formEl, type, entry, today);
  });

  formEl.querySelectorAll(".proposal-textarea").forEach((textarea) => {
    if (!(textarea instanceof HTMLTextAreaElement)) {
      return;
    }

    const resizeTextarea = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };

    resizeTextarea();
    textarea.addEventListener("input", resizeTextarea);
  });
}

function buildFormFields(type, entry) {
  const recommendOptions = RECOMMEND_OPTIONS.map(
    (o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`
  ).join("");

  if (type === "new") {
    return `
      <div class="proposal-field">
        <div class="proposal-stack-label field"><span>レベル（必須）</span>
          <input class="proposal-input proposal-input-level" name="level_new" required aria-label="レベル（必須）"
          pattern="^[0-9]{1,2}\\.[0-9]{2}$" maxlength="5"
          title="小数点以下2桁（例: 11.00）">
        </div>
      </div>
      <div class="proposal-field">
        <div class="proposal-stack-label field"><span>おすすめ度（任意）</span>
          <div class="field-select proposal-select-wrap">
            <select class="proposal-select" name="recommend_new" aria-label="おすすめ度（任意）">${recommendOptions}</select>
          </div>
        </div>
      </div>
      <div class="proposal-field">
        <div class="proposal-stack-label field"><span>コメント（任意）</span>
          <textarea class="proposal-textarea" name="comment_new" rows="3" aria-label="コメント（任意）"></textarea>
        </div>
        <small class="proposal-note">※譜面傾向、攻略情報などなんでも（表に反映されます）</small>
      </div>
    `;
  }

  if (type === "change") {
    const currentLevelRaw = entry.level ? entry.level.replace(/^[☆†]*[☆†]/, "") : "";
    const currentLevel = escapeHtml(currentLevelRaw);
    return `
      <div class="proposal-field proposal-current">
        現在のレベル <strong>☆${currentLevel}</strong>
      </div>
      <div class="proposal-field">
        <div class="proposal-stack-label field"><span>変更後レベル（必須）</span>
          <input class="proposal-input proposal-input-level" name="level_change" required aria-label="変更後レベル（必須）"
          pattern="^[0-9]{1,2}\\.[0-9]{2}$" maxlength="5"
          title="小数点以下2桁（例: 11.00）"
          data-current="${currentLevel}">
        </div>
      </div>
      <div class="proposal-field">
        <div class="proposal-stack-label field"><span>提案理由（必須）</span>
          <textarea class="proposal-textarea" name="reason_change" rows="3" required aria-label="提案理由（必須）"></textarea>
        </div>
      </div>
    `;
  }

  return `
    <div class="proposal-field proposal-current">
      現在のおすすめ度 <strong>${escapeHtml(entry.recommend || "無記入")}</strong>
    </div>
    <div class="proposal-field">
      <div class="proposal-stack-label field"><span>変更後おすすめ度（必須）</span>
        <div class="field-select proposal-select-wrap">
          <select class="proposal-select" name="recommend_change" required aria-label="変更後おすすめ度（必須）">
            ${recommendOptions}
          </select>
        </div>
      </div>
    </div>
    <div class="proposal-field">
      <div class="proposal-stack-label field"><span>提案理由（必須）</span>
        <textarea class="proposal-textarea" name="reason_recommend" rows="3" required aria-label="提案理由（必須）"></textarea>
      </div>
    </div>
  `;
}

function getProposalTypeLabel(type) {
  if (type === "new") {
    return "新規提案";
  }

  if (type === "change") {
    return "変更提案";
  }

  return "おすすめ提案";
}

function renderProposalSuccess(container, type, sheetUrl) {
  if (!container) {
    return;
  }

  const typeLabel = getProposalTypeLabel(type);

  container.innerHTML = `
    <div class="proposal-success">
      <p class="proposal-success-title">
        ${escapeHtml(typeLabel)}を送信しました。
      </p>
      <p class="proposal-success-body">
        送信内容を確認する場合は、<a href="${escapeHtml(sheetUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(typeLabel)}シート</a>を参照してください（外部スプレッドシートを開きます）。
      </p>
    </div>
  `;

  container.dataset.openType = "success";
}

function renderProposalError(statusEl, type, message) {
  if (type === "new" && String(message ?? "").trim() === NEW_PROPOSAL_DUPLICATE_ERROR) {
    statusEl.innerHTML = `
      <div class="proposal-status-error">
        <p>この譜面はすでに提案されています。</p>
        <p>提案内容を確認する場合は、<a class="proposal-link" href="${escapeHtml(NEW_PROPOSAL_SHEET_URL)}" target="_blank" rel="noopener">新規提案シート</a>を参照してください（外部スプレッドシートを開きます）。</p>
      </div>
    `;
    return;
  }

  statusEl.textContent = `送信に失敗しました: ${message ?? "不明なエラー"}`;
}

async function handleProposalSubmit(formEl, type, entry, today) {
  const statusEl = formEl.querySelector(".proposal-status");
  const submitBtn = formEl.querySelector(".proposal-submit-btn");

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
      const container = formEl.parentElement;
      renderProposalSuccess(container, type, sheetUrl);
    } else {
      renderProposalError(statusEl, type, result.message);
      submitBtn.disabled = false;
    }
  } catch (err) {
    console.error("提案送信エラー:", err);
    statusEl.textContent = "送信に失敗しました。時間をおいて再試行してください。";
    submitBtn.disabled = false;
  }
}
