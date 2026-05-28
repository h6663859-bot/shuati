// =========================================================
        // JavaScript 核心逻辑 (Version 20.0)
        // =========================================================

        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        let quizData = [];
        let userAnswers = [];
        let currentQuestionIndex = 0;
        let seconds = 0;
        let timerInterval = null;
        let isExamFinished = false;
        let isCardVisible = false;
        let currentQuizName = null;
        let currentQuizHash = null;
        let appState = 'Home';
        let isMemorizeMode = false;
        // V15.0: 拆分乱序控制为两个独立开关
        let isShuffleQuestions = true;
        let isShuffleOptions = true;
        // V15.0: 背题模式答对自动跳转
        let isAutoAdvance = false;
        let autoAdvanceTimer = null;
        // 错题回插
        var isWrongReinsert = false;
        var _wrongQueue = null;
        // V17.0: 设置抽屉状态 & 题库列表折叠状态
        let isDrawerOpen = false;
        let isQuizListCollapsed = false;

        const HISTORY_LIMIT = 5;
        const QUIZ_LIST_KEY = 'QUIZ_LIST_V8_5';
        const SETTINGS_KEY = 'SETTINGS_V20';

        const timeDisplay = document.getElementById('time-display');
        const submitBtn = document.getElementById('submit-btn');
        const homePage = document.getElementById('home-page');
        const quizArea = document.getElementById('quiz-area');
        const statsPage = document.getElementById('stats-page');
        const currentQuizDisplay = document.getElementById('current-quiz-display');
        const quizListContainer = document.getElementById('quiz-list-container');
        const questionDisplayArea = document.getElementById('question-display-area');
        const cardGrid = document.getElementById('card-grid');
        const answerCardArea = document.getElementById('answer-card-area');
        const resultSummaryDiv = document.getElementById('exam-result-summary');
        const cardToggleButton = document.getElementById('card-toggle-btn');
        const bottomNav = document.getElementById('bottom-nav');
        const lastScoreDisplay = document.getElementById('last-score');
        const historyListContent = document.getElementById('history-list-content');
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        const memorizeBanner = document.getElementById('memorize-banner');
        // V17.0 新增元素
        const settingsDrawer = document.getElementById('settings-drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');
        const settingsGearBtn = document.getElementById('settings-gear-btn');
        const quizListScrollWrapper = document.getElementById('quiz-list-scroll-wrapper');
        const quizListCollapseBar = document.getElementById('quiz-list-collapse-bar');
        const quizListCollapseBtn = document.getElementById('quiz-list-collapse-btn');
        const quizListCollapseText = document.getElementById('quiz-list-collapse-text');

        // =========================================================
        // A. V20.5: 暗色模式切换
        // =========================================================
        var isDarkMode = false;
        window.toggleDarkMode = function() {
            isDarkMode = !isDarkMode;
            var html = document.documentElement;
            var icon = document.querySelector('#dark-mode-btn .material-icons');
            if (isDarkMode) {
                html.setAttribute('data-theme', 'dark');
                if (icon) icon.textContent = 'light_mode';
            } else {
                html.removeAttribute('data-theme');
                if (icon) icon.textContent = 'dark_mode';
            }
            try { localStorage.setItem('DARK_MODE', isDarkMode ? '1' : '0'); } catch(e) {}
        };
        (function() {
            try { isDarkMode = localStorage.getItem('DARK_MODE') === '1'; } catch(e) {}
            if (isDarkMode) {
                document.documentElement.setAttribute('data-theme', 'dark');
                var icon = document.querySelector('#dark-mode-btn .material-icons');
                if (icon) icon.textContent = 'light_mode';
            }
        })();

        // =========================================================
        // B. V20.0: 设置持久化（LocalStorage 读写）
        // =========================================================

        function saveSettings() {
            var settings = {
                isMemorizeMode: isMemorizeMode,
                isShuffleQuestions: isShuffleQuestions,
                isShuffleOptions: isShuffleOptions,
                isAutoAdvance: isAutoAdvance,
                isWrongReinsert: isWrongReinsert
            };
            try {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            } catch(e) {
                console.error('保存设置失败:', e);
            }
        }

        function loadSettings() {
            try {
                var saved = localStorage.getItem(SETTINGS_KEY);
                if (saved) {
                    var settings = JSON.parse(saved);
                    if (typeof settings.isMemorizeMode === 'boolean') isMemorizeMode = settings.isMemorizeMode;
                    if (typeof settings.isShuffleQuestions === 'boolean') isShuffleQuestions = settings.isShuffleQuestions;
                    if (typeof settings.isShuffleOptions === 'boolean') isShuffleOptions = settings.isShuffleOptions;
                    if (typeof settings.isAutoAdvance === 'boolean') isAutoAdvance = settings.isAutoAdvance;
                    if (typeof settings.isWrongReinsert === 'boolean') isWrongReinsert = settings.isWrongReinsert;
                }
            } catch(e) {
                console.error('加载设置失败:', e);
            }
        }

        function applySettingsToUI() {
            // 同步模式选择器
            var modeNormal = document.getElementById('mode-normal');
            var modeMemorize = document.getElementById('mode-memorize');

            if (isMemorizeMode) {
                if (modeMemorize) modeMemorize.checked = true;
                if (modeNormal) modeNormal.checked = false;
                if (modeMemorize) {
                    var optM = modeMemorize.closest('.mode-option');
                    if (optM) optM.classList.add('selected');
                }
                if (modeNormal) {
                    var optN = modeNormal.closest('.mode-option');
                    if (optN) optN.classList.remove('selected');
                }
            } else {
                if (modeNormal) modeNormal.checked = true;
                if (modeMemorize) modeMemorize.checked = false;
                if (modeNormal) {
                    var optN2 = modeNormal.closest('.mode-option');
                    if (optN2) optN2.classList.add('selected');
                }
                if (modeMemorize) {
                    var optM2 = modeMemorize.closest('.mode-option');
                    if (optM2) optM2.classList.remove('selected');
                }
            }

            // 同步三个开关
            var qToggle = document.getElementById('shuffle-questions-toggle');
            var oToggle = document.getElementById('shuffle-options-toggle');
            var aToggle = document.getElementById('auto-advance-toggle');

            if (qToggle) {
                if (isShuffleQuestions) qToggle.classList.add('active');
                else qToggle.classList.remove('active');
            }
            if (oToggle) {
                if (isShuffleOptions) oToggle.classList.add('active');
                else oToggle.classList.remove('active');
            }
            if (aToggle) {
                if (isAutoAdvance) aToggle.classList.add('active');
                else aToggle.classList.remove('active');
            }
            var wToggle = document.getElementById('wrong-reinsert-toggle');
            if (wToggle) {
                if (isWrongReinsert) wToggle.classList.add('active');
                else wToggle.classList.remove('active');
            }
        }

        // =========================================================
        // A2. 安全与通知工具函数 (V20.1)
        // =========================================================

        /** HTML 实体转义 — 所有用户数据进入 innerHTML 前必须过此函数 */
        function escapeHtml(str) {
            if (str == null) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        /** JS 字符串字面量转义 — onclick 等属性中嵌入用户数据时使用 */
        function escapeJsStr(str) {
            if (str == null) return '';
            return String(str)
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '');
        }

        /** 轻量 toast 通知 — 页面顶部浮现后自动消失 */
        function showToast(msg, type) {
            type = type || 'info';
            var container = document.getElementById('toast-container');
            if (!container) return;
            var el = document.createElement('div');
            el.className = 'toast-item toast-' + type;
            el.textContent = msg;
            container.appendChild(el);
            el.addEventListener('animationend', function(e) {
                if (e.animationName === 'toastOut') {
                    if (el.parentNode) el.parentNode.removeChild(el);
                }
            });
        }

        // =========================================================
        // B. 状态管理与通用工具函数
        // =========================================================

        function showLoading(text) {
            loadingText.textContent = text || '正在解析文件...';
            loadingOverlay.style.display = 'flex';
        }

        function hideLoading() {
            loadingOverlay.style.display = 'none';
        }

        // V20.0: 底部导航栏切换处理（无声暂停与恢复，无任何遮罩层）
        window.handleNavClick = function(element) {
            var newState = element.dataset.state;

            if (newState === 'Home') {
                setAppState('Home');
            } else if (newState === 'Quiz') {
                if (quizData.length === 0) {
                    alert("请先在首页导入或选择一个题库进行练习！");
                    setAppState('Home');
                } else {
                    // 静默恢复：直接切回作答现场
                    setAppState(isExamFinished ? 'Review' : 'Quiz');
                }
            } else if (newState === 'Stats') {
                setAppState('Stats');
            }
        };

        window.setAppState = function(newState) {
            // V20.0: 切离作答区时静默保存进度（无视觉弹窗）
            if ((appState === 'Quiz' || appState === 'Review') &&
                newState !== 'Quiz' && newState !== 'Review' &&
                !isExamFinished && quizData.length > 0 && currentQuizName) {
                saveActiveProgress();
            }

            appState = newState;
            stopTimer();
            clearAutoAdvanceTimer();
            window.scrollTo(0, 0);

            homePage.style.display = 'none';
            quizArea.style.display = 'none';
            statsPage.style.display = 'none';

            document.querySelectorAll('.nav-item').forEach(function(item) {
                item.classList.remove('active');
                if (item.dataset.state === newState) {
                    item.classList.add('active');
                }
                // 确保练习按钮在 Quiz/Review 状态下高亮
                if ((newState === 'Quiz' || newState === 'Review') && item.dataset.state === 'Quiz') {
                    item.classList.add('active');
                }
            });

            var isMobile = window.innerWidth <= 768;
            if (!isMobile) {
                answerCardArea.style.position = 'sticky';
                answerCardArea.classList.add('visible');
                isCardVisible = true;
            } else {
                answerCardArea.style.position = 'fixed';
            }

            var swipeHint = document.getElementById('swipe-hint');
            if (swipeHint) swipeHint.style.display = 'none';

            if (newState === 'Home') {
                homePage.style.display = 'block';
                if (isMobile) {
                    answerCardArea.classList.remove('visible');
                }
                renderHomePage();
            } else if (newState === 'Quiz' || newState === 'Review') {
                quizArea.style.display = 'block';
                currentQuizDisplay.textContent = currentQuizName || '正在答题';

                submitBtn.style.display = newState === 'Quiz' ? 'block' : 'none';
                if (isMemorizeMode) {
                    memorizeBanner.style.display = 'flex';
                } else {
                    memorizeBanner.style.display = 'none';
                }

                if (isMobile) {
                    answerCardArea.classList.remove('visible');
                    isCardVisible = false;
                }

                if (swipeHint && newState === 'Quiz') swipeHint.style.display = 'block';

                initQuizUI();
            } else if (newState === 'Stats') {
                statsPage.style.display = 'block';
                if (isMobile) {
                    answerCardArea.classList.remove('visible');
                }
                renderStatsPage();
            }
        };

        function shuffleArray(array) {
            var shuffled = array.slice();
            for (var i = shuffled.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = shuffled[i];
                shuffled[i] = shuffled[j];
                shuffled[j] = temp;
            }
            return shuffled;
        }

        function checkAnswer(questionData, userAnswer) {
            if (!userAnswer) return false;
            if (questionData.type.indexOf('多选') !== -1) {
                var userSorted = (Array.isArray(userAnswer) ? userAnswer.slice().sort().join('') : userAnswer.split('').sort().join(''));
                var keySorted = questionData.answerKey.split('').sort().join('');
                return userSorted === keySorted;
            } else {
                return userAnswer === questionData.answerKey;
            }
        }

        function hasAnswered(answer) {
            return Array.isArray(answer) ? answer.length > 0 : answer !== null;
        }

        /**
         * 为题目数组中的每道题生成 shuffledOptions（基于原始 options 的乱序副本）。
         */
        function initializeQuestionOptions(questions) {
            questions.forEach(function(q) {
                q.shuffledOptions = shuffleArray(q.options.slice());
            });
            return questions;
        }

        // =========================================================
        // V17.0: 设置抽屉开关
        // =========================================================
        window.toggleSettingsDrawer = function() {
            isDrawerOpen = !isDrawerOpen;
            if (isDrawerOpen) {
                settingsDrawer.classList.add('visible');
                drawerOverlay.classList.add('visible');
                settingsGearBtn.classList.add('spinning');
                setTimeout(function() { settingsGearBtn.classList.remove('spinning'); }, 600);
                document.body.style.overflow = 'hidden';
            } else {
                settingsDrawer.classList.remove('visible');
                drawerOverlay.classList.remove('visible');
                document.body.style.overflow = '';
            }
        };

        // =========================================================
        // V17.0: 题库列表折叠/展开
        // =========================================================
        window.toggleQuizListCollapse = function() {
            isQuizListCollapsed = !isQuizListCollapsed;
            if (isQuizListCollapsed) {
                quizListScrollWrapper.classList.add('collapsed');
                quizListCollapseBtn.querySelector('.material-icons').textContent = 'unfold_more';
                quizListCollapseText.textContent = '展开题库列表';
            } else {
                quizListScrollWrapper.classList.remove('collapsed');
                quizListCollapseBtn.querySelector('.material-icons').textContent = 'unfold_less';
                quizListCollapseText.textContent = '收起题库列表';
            }
        };

        // =========================================================
        // V20.0: 统计页折叠卡片切换
        // =========================================================
        window.toggleAccordion = function(header) {
            var accordion = header.parentElement;
            accordion.classList.toggle('open');
        };

        // =========================================================
        // V20.0: 模式选择（含持久化）
        // =========================================================

        window.selectMode = function(element, mode) {
            var options = document.querySelectorAll('.mode-option');
            options.forEach(function(opt) { opt.classList.remove('selected'); });
            element.classList.add('selected');
            var radio = element.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
            isMemorizeMode = (mode === 'memorize');
            saveSettings();
        };

        // V20.0: 三个独立开关的切换（含持久化）
        window.toggleShuffleQuestions = function() {
            isShuffleQuestions = !isShuffleQuestions;
            var toggleEl = document.getElementById('shuffle-questions-toggle');
            if (isShuffleQuestions) {
                toggleEl.classList.add('active');
            } else {
                toggleEl.classList.remove('active');
            }
            saveSettings();
        };

        window.toggleShuffleOptions = function() {
            isShuffleOptions = !isShuffleOptions;
            var toggleEl = document.getElementById('shuffle-options-toggle');
            if (isShuffleOptions) {
                toggleEl.classList.add('active');
            } else {
                toggleEl.classList.remove('active');
            }
            saveSettings();
        };

        window.toggleAutoAdvance = function() {
            isAutoAdvance = !isAutoAdvance;
            var toggleEl = document.getElementById('auto-advance-toggle');
            if (isAutoAdvance) {
                toggleEl.classList.add('active');
            } else {
                toggleEl.classList.remove('active');
                clearAutoAdvanceTimer();
            }
            saveSettings();
        };

        window.toggleWrongReinsert = function() {
            isWrongReinsert = !isWrongReinsert;
            var toggleEl = document.getElementById('wrong-reinsert-toggle');
            if (!toggleEl) return;
            if (isWrongReinsert) {
                toggleEl.classList.add('active');
            } else {
                toggleEl.classList.remove('active');
                _wrongQueue = null;
            }
            saveSettings();
        };

        // =========================================================
        // C. 题库、进度与历史管理
        // =========================================================

        function generateQuizHash(quizData) {
            if (!quizData || quizData.length === 0) return 'NO_DATA';
            var content = quizData.slice(0, 10).map(function(q) {
                var indexPart = q.originalIndex !== undefined ? 'IDX_' + q.originalIndex : '';
                return indexPart + q.question.substring(0, 50) + q.answerKey;
            }).join('|');

            var hash = 0;
            for (var i = 0; i < content.length; i++) {
                var char = content.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash |= 0;
            }
            return 'QZ_' + Math.abs(hash).toString(36);
        }

        function saveActiveProgress() {
            if (!currentQuizName || quizData.length === 0 || !currentQuizHash) return;
            try {
                var activeKey = 'PROGRESS_' + currentQuizName + '_' + currentQuizHash;
                var dataToSave = JSON.stringify({
                    quizData: quizData,
                    userAnswers: userAnswers,
                    seconds: seconds,
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem(activeKey, dataToSave);
            } catch (e) {
                console.error("保存活跃进度失败:", e);
                showToast('自动保存进度失败，存储空间可能不足', 'warn');
            }
        }

        function loadActiveProgress(quizName, hash) {
            if (!quizName || !hash) return false;
            try {
                var activeKey = 'PROGRESS_' + quizName + '_' + hash;
                var savedData = localStorage.getItem(activeKey);
                if (savedData) {
                    var data = JSON.parse(savedData);
                    quizData = data.quizData || [];
                    userAnswers = data.userAnswers || [];
                    seconds = data.seconds || 0;
                    isExamFinished = false;
                    return true;
                }
            } catch (e) {
                localStorage.removeItem('PROGRESS_' + quizName + '_' + hash);
            }
            return false;
        }

        function getQuizList() {
            try {
                var storedList = localStorage.getItem(QUIZ_LIST_KEY);
                return storedList ? JSON.parse(storedList) : [];
            } catch (e) {
                return [];
            }
        }

        function saveQuizToList(name, rawText, parsedData) {
            try {
                var quizList = getQuizList();
                var hash = generateQuizHash(parsedData);
                var dataKey = 'RAW_DATA_' + name + '_' + hash;

                var existingIndex = quizList.findIndex(function(q) { return q.name === name; });

                if (existingIndex !== -1) {
                    var oldQuiz = quizList[existingIndex];
                    localStorage.removeItem(oldQuiz.dataKey);
                    localStorage.removeItem('PROGRESS_' + oldQuiz.name + '_' + oldQuiz.hash);
                    localStorage.removeItem('HISTORY_' + oldQuiz.name + '_' + oldQuiz.hash);
                    quizList.splice(existingIndex, 1);
                }

                localStorage.setItem(dataKey, rawText);

                quizList.unshift({
                    name: name,
                    hash: hash,
                    questionCount: parsedData.length,
                    dataKey: dataKey,
                    timestamp: new Date().toISOString()
                });

                localStorage.setItem(QUIZ_LIST_KEY, JSON.stringify(quizList));
            } catch (e) {
                showToast('保存题库失败，存储空间不足，请清理旧题库后重试', 'error');
            }
        }

        window.startQuiz = function(quizName) {
            clearAutoAdvanceTimer();

            // V17.0: 关闭抽屉再进入刷题
            if (isDrawerOpen) {
                toggleSettingsDrawer();
            }

            var modeNormal = document.getElementById('mode-normal');
            isMemorizeMode = modeNormal ? !modeNormal.checked : false;

            var quizList = getQuizList();
            var targetQuiz = quizList.find(function(q) { return q.name === quizName; });

            if (!targetQuiz) {
                alert("找不到该题库，请重新导入。");
                return;
            }

            currentQuizName = quizName;
            currentQuizHash = targetQuiz.hash;
            currentQuestionIndex = 0;

            var rawText = localStorage.getItem(targetQuiz.dataKey);

            if (rawText) {
                var loadedProgress = false;

                if (!loadActiveProgress(quizName, targetQuiz.hash)) {
                    quizData = parseQuizText(rawText);

                    userAnswers = new Array(quizData.length).fill(null).map(function(_, index) {
                        var qType = quizData[index].type;
                        return qType && qType.indexOf('多选') !== -1 ? [] : null;
                    });
                    seconds = 0;
                } else {
                    loadedProgress = true;
                }

                // V15.0: 根据独立开关分别处理乱序
                if (isShuffleQuestions) {
                    quizData = shuffleArray(quizData);
                }
                if (isShuffleOptions) {
                    quizData = initializeQuestionOptions(quizData);
                } else {
                    quizData.forEach(function(q) {
                        if (!q.shuffledOptions) {
                            q.shuffledOptions = q.options.slice();
                        }
                    });
                }

                isExamFinished = false;

                // 错题回插：初始化队列
                _wrongQueue = null;
                if (isMemorizeMode && isWrongReinsert) {
                    _wrongQueue = [];
                    for (var qi = 0; qi < quizData.length; qi++) _wrongQueue.push(qi);
                }

                setAppState('Quiz');

                console.log((isMemorizeMode ? '背题模式 - ' : '普通模式 - ') +
                    (isShuffleQuestions ? '题目乱序已启用 - ' : '题目保持原序 - ') +
                    (isShuffleOptions ? '选项乱序已启用 - ' : '选项保持原序 - ') +
                    (loadedProgress ? '已加载题库「' + quizName + '」的上次进度，请继续作答！' : '已加载题库「' + quizName + '」，开始计时答题！'));

            } else {
                alert("错误：未能加载题库原始数据。");
            }
        };

        window.confirmRestartQuiz = function() {
            if (confirm("确定要重新开始当前题库的考试吗？所有未交卷的进度将被清除！")) {
                restartQuiz();
            }
        };

        function restartQuiz() {
            clearAutoAdvanceTimer();

            if (quizData.length === 0 || !currentQuizName) {
                alert("请先导入或选择题库文件。");
                return;
            }

            var quizList = getQuizList();
            var targetQuiz = quizList.find(function(q) { return q.name === currentQuizName && q.hash === currentQuizHash; });
            if (!targetQuiz) {
                alert("题库源文件丢失，请重新导入。");
                setAppState('Home');
                return;
            }
            var rawText = localStorage.getItem(targetQuiz.dataKey);
            var tempQuizData = parseQuizText(rawText);

            if (isShuffleQuestions) {
                quizData = shuffleArray(tempQuizData);
            } else {
                quizData = tempQuizData;
            }
            if (isShuffleOptions) {
                quizData = initializeQuestionOptions(quizData);
            } else {
                quizData.forEach(function(q) {
                    if (!q.shuffledOptions) {
                        q.shuffledOptions = q.options.slice();
                    }
                });
            }

            userAnswers = new Array(quizData.length).fill(null).map(function(_, index) {
                var qType = quizData[index].type;
                return qType && qType.indexOf('多选') !== -1 ? [] : null;
            });
            seconds = 0;
            currentQuestionIndex = 0;
            isExamFinished = false;

            // 错题回插：重新初始化队列
            _wrongQueue = null;
            if (isMemorizeMode && isWrongReinsert) {
                _wrongQueue = [];
                for (var qi2 = 0; qi2 < quizData.length; qi2++) _wrongQueue.push(qi2);
            }

            localStorage.removeItem('PROGRESS_' + currentQuizName + '_' + currentQuizHash);

            initQuizUI();
            submitBtn.disabled = false;
            submitBtn.textContent = "交卷";
            setAppState('Quiz');
            if (window.innerWidth <= 768) toggleAnswerCard(false);
        }

        function saveHistory(answers, time) {
            if (!currentQuizName || !currentQuizHash) return;
            var historyKey = 'HISTORY_' + currentQuizName + '_' + currentQuizHash;
            var history = [];
            try {
                var savedHistory = localStorage.getItem(historyKey);
                if (savedHistory) {
                    history = JSON.parse(savedHistory);
                }
            } catch (e) { /* ignore */ }

            var newRecord = {
                userAnswers: answers,
                seconds: time,
                quizData: quizData.map(function(q) {
                    return {
                        id: q.id,
                        originalIndex: q.originalIndex,
                        question: q.question,
                        answerKey: q.answerKey,
                        options: q.options,
                        type: q.type,
                        analysis: q.analysis,
                        shuffledOptions: q.shuffledOptions
                    };
                }),
                timestamp: new Date().toISOString()
            };

            history.unshift(newRecord);

            if (history.length > HISTORY_LIMIT) {
                history = history.slice(0, HISTORY_LIMIT);
            }

            localStorage.setItem(historyKey, JSON.stringify(history));
        }

        // V20.0: 删除单条历史记录 — 无弹窗静默删除 + 卡片淡出消失
        window.deleteHistoryRecord = function(quizName, quizHash, historyIndex, cardElement) {
            // 1. 先执行 LocalStorage 删除
            var historyKey = 'HISTORY_' + quizName + '_' + quizHash;
            try {
                var history = JSON.parse(localStorage.getItem(historyKey));
                if (history && history[historyIndex] !== undefined) {
                    history.splice(historyIndex, 1);
                    if (history.length === 0) {
                        localStorage.removeItem(historyKey);
                    } else {
                        localStorage.setItem(historyKey, JSON.stringify(history));
                    }
                }
            } catch (e) {
                console.error("删除历史记录失败:", e);
                showToast('删除历史记录失败', 'error');
                return;
            }

            // 2. 卡片淡出动画
            if (cardElement) {
                // 找到 .history-card 外壳（如果传入的是 button 则向上查找）
                var card = cardElement.closest ? cardElement.closest('.history-card') : cardElement;
                if (card) {
                    card.classList.add('fading');
                    card.addEventListener('animationend', function handler() {
                        card.removeEventListener('animationend', handler);
                        if (card.parentNode) card.parentNode.removeChild(card);
                        // 检查该题库是否还有剩余历史卡片，若无可折叠该 Accordion
                        var accordionBody = card.closest('.stats-accordion-body');
                        if (accordionBody && accordionBody.querySelectorAll('.history-card').length === 0) {
                            var accordion = accordionBody.closest('.stats-accordion');
                            if (accordion && accordion.parentNode) {
                                accordion.parentNode.removeChild(accordion);
                            }
                        }
                        // 重新计算全局统计
                        refreshGlobalStats();
                    });
                    return;
                }
            }

            // 兜底：若无卡片引用，整页刷新
            renderStatsPage();
        };

        // V20.0: 回顾历史（只回顾错题）
        window.reviewHistoricalQuiz = function(quizName, quizHash, historyIndex) {
            clearAutoAdvanceTimer();

            var historyKey = 'HISTORY_' + quizName + '_' + quizHash;
            try {
                var history = JSON.parse(localStorage.getItem(historyKey));
                if (history && history[historyIndex]) {
                    var record = history[historyIndex];

                    currentQuizName = quizName;
                    currentQuizHash = quizHash;

                    // V20.0: 只筛选错题进入回顾
                    var wrongQuizData = [];
                    var wrongUserAnswers = [];
                    record.quizData.forEach(function(q, idx) {
                        if (!checkAnswer(q, record.userAnswers[idx])) {
                            wrongQuizData.push(q);
                            wrongUserAnswers.push(record.userAnswers[idx]);
                        }
                    });

                    if (wrongQuizData.length === 0) {
                        alert("该次考试全部答对，没有错题可供回顾！");
                        return;
                    }

                    quizData = wrongQuizData;
                    userAnswers = wrongUserAnswers;
                    seconds = record.seconds;
                    isExamFinished = true;
                    currentQuestionIndex = 0;

                    setAppState('Review');
                    alert('已加载 ' + quizName + ' 的历史回顾，共 ' + quizData.length + ' 道错题，总用时：' + new Date(seconds * 1000).toISOString().substr(11, 8));
                }
            } catch (e) {
                alert("加载历史记录失败。");
            }
        };

        window.startReviewWrongQuiz = function(quizName, quizHash, historyIndex) {
            clearAutoAdvanceTimer();

            var historyKey = 'HISTORY_' + quizName + '_' + quizHash;
            try {
                var history = JSON.parse(localStorage.getItem(historyKey));
                if (history && history[historyIndex]) {
                    var record = history[historyIndex];

                    var wrongQuestions = [];
                    record.quizData.forEach(function(q, qIndex) {
                        if (!checkAnswer(q, record.userAnswers[qIndex])) {
                            wrongQuestions.push(q);
                        }
                    });

                    if (wrongQuestions.length === 0) {
                        alert("本次考试中没有做错的题目，无需重做！");
                        return;
                    }

                    currentQuizName = quizName;
                    currentQuizHash = quizHash;

                    if (isShuffleQuestions) {
                        quizData = shuffleArray(wrongQuestions);
                    } else {
                        quizData = wrongQuestions;
                    }
                    localStorage.removeItem('PROGRESS_' + currentQuizName + '_' + currentQuizHash);

                    userAnswers = new Array(quizData.length).fill(null).map(function(_, index) {
                        var qType = quizData[index].type;
                        return qType && qType.indexOf('多选') !== -1 ? [] : null;
                    });
                    seconds = 0;
                    currentQuestionIndex = 0;
                    isExamFinished = false;

                    if (isShuffleOptions) {
                        quizData = initializeQuestionOptions(quizData);
                    } else {
                        quizData.forEach(function(q) {
                            if (!q.shuffledOptions) {
                                q.shuffledOptions = q.options.slice();
                            }
                        });
                    }

                    setAppState('Quiz');

                    alert('已从 ' + quizName + ' 中筛选出 ' + quizData.length + ' 道错题，开始重做！');
                }
            } catch (e) {
                alert("加载错题重做数据失败。");
            }
        };

        window.deleteQuiz = function(quizName, quizHash) {
            if (!confirm('警告：确定要删除题库「' + quizName + '」及其所有历史记录和进度吗？此操作不可逆！')) {
                return;
            }

            localStorage.removeItem('PROGRESS_' + quizName + '_' + quizHash);
            localStorage.removeItem('HISTORY_' + quizName + '_' + quizHash);

            var quizList = getQuizList();
            var targetQuiz = quizList.find(function(q) { return q.name === quizName && q.hash === quizHash; });
            if (targetQuiz) {
                localStorage.removeItem(targetQuiz.dataKey);
            }

            quizList = quizList.filter(function(q) { return !(q.name === quizName && q.hash === quizHash); });
            localStorage.setItem(QUIZ_LIST_KEY, JSON.stringify(quizList));

            if (currentQuizName === quizName && currentQuizHash === quizHash) {
                currentQuizName = null;
                currentQuizHash = null;
                quizData = [];
                userAnswers = [];
            }

            alert('题库「' + quizName + '」已删除。');
            renderHomePage();
        };

        // =========================================================
        // D. 题库文本解析
        // =========================================================
        function parseQuizText(rawText) {
            var parsedData = [];
            var lines = rawText.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

            var cur = null, curAnalysis = '', pending = '', lastLabel = null;
            var questionRegex = /^(\d+)\s*([.、)\]])\s*(?:\(([单多]选题)[,，]\s*[\d.]+\s*分\))?\s*(.*)$/;
            var optionRegex = /^([A-Z])\s*([.、)\]])\s*(.*)$/;
            var answerRegex = /(?:正确答案|【答案】|答案|KEY|Answer)[：:]\s*([A-Z]+)/i;
            var analysisRegex = /^(?:解析|分析|Analysis)[：:]\s*(.*)$/i;
            var sectionRegex = /^[一二三四五六七八九十]+[.、]\s*(?:单选题|多选题|判断题)/;
            var isAnalysis = false, detType = "单选题";

            function _flush() {
                if (lastLabel && pending) { cur.options.push({ label: lastLabel + '.', text: pending.trim() }); pending = ''; lastLabel = null; }
            }
            function _finish() {
                _flush();
                if (cur && cur.options.length > 0 && cur.answerKey) { cur.analysis = curAnalysis.trim(); parsedData.push(cur); }
            }

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];

                if (sectionRegex.test(line)) { detType = line.indexOf('多选') !== -1 ? "多选题" : "单选题"; continue; }

                var am = line.match(answerRegex);
                if (am && cur) { _flush(); cur.answerKey = am[1].toUpperCase(); if (cur.answerKey.length > 1) cur.type = "多选题"; isAnalysis = false; continue; }

                var qm = line.match(questionRegex);
                if (qm) {
                    _finish();
                    var qt = detType;
                    if (qm[3]) qt = qm[3].indexOf('多') !== -1 ? "多选题" : "单选题";
                    cur = { id: parsedData.length + 1, originalIndex: parsedData.length, type: qt, question: (qm[4]||'').trim(), options: [], answerKey: null, analysis: '', shuffledOptions: null };
                    pending = ''; lastLabel = null; curAnalysis = ''; isAnalysis = false;
                    continue;
                }
                if (!cur) continue;

                var om = line.match(optionRegex);
                if (om && !isAnalysis) { _flush(); lastLabel = om[1]; pending = om[3] ? om[3].trim() : ''; continue; }

                var xm = line.match(analysisRegex);
                if (xm) { _flush(); isAnalysis = true; curAnalysis = (xm[1]||'').trim() + ' '; continue; }

                if (isAnalysis) { curAnalysis += line + ' '; }
                else if (lastLabel !== null) { pending += (pending ? ' ' : '') + line; }
                else if (cur && cur.options.length === 0) { cur.question += (cur.question ? ' ' : '') + line; }
            }

            _finish();

            // 校验 + toast
            var rawCount = parsedData.length;
            parsedData = parsedData.filter(function(q) {
                if (q.options.length < 2) return false;
                if (!q.answerKey || q.answerKey.length === 0) return false;
                var validLabels = q.options.map(function(o) { return o.label[0]; });
                var keys = q.answerKey.split('');
                for (var ki = 0; ki < keys.length; ki++) {
                    if (validLabels.indexOf(keys[ki]) === -1) return false;
                }
                return true;
            });
            if (rawCount > 0 && parsedData.length === 0) {
                showToast('解析到 ' + rawCount + ' 条疑似题目但全部校验失败，请检查文件格式', 'warn');
            } else if (rawCount > parsedData.length) {
                showToast('已跳过 ' + (rawCount - parsedData.length) + ' 道格式不符的题目（缺少选项/答案不匹配）', 'warn');
            }

            return parsedData;
        }

        // =========================================================
        // E. UI 渲染与流程控制
        // =========================================================

        function renderHomePage() {
            var quizList = getQuizList();
            quizListContainer.innerHTML = '';

            if (quizList.length === 0) {
                quizListContainer.innerHTML = '<p style="color: var(--color-text-secondary);">尚未导入任何题库。请点击下方按钮上传文件。</p>';
                quizListCollapseBar.style.display = 'none';
                quizListScrollWrapper.classList.remove('collapsed');
                isQuizListCollapsed = false;
                return;
            }

            quizListCollapseBar.style.display = 'block';

            quizList.forEach(function(quiz) {
                var activeKey = 'PROGRESS_' + quiz.name + '_' + quiz.hash;
                var savedData = localStorage.getItem(activeKey);
                var progressText = '未开始';
                var startBtnText = '开始答题';
                var answeredCount = 0;

                if (savedData) {
                    var data = JSON.parse(savedData);
                    if (data.userAnswers && Array.isArray(data.userAnswers)) {
                        answeredCount = data.userAnswers.filter(function(a) {
                            return hasAnswered(a);
                        }).length;
                    }
                    var remaining = quiz.questionCount - answeredCount;
                    progressText = '已答 ' + answeredCount + ' 题 (剩余 ' + remaining + ' 题)';
                    startBtnText = '继续答题';
                }

                var safeName = escapeHtml(quiz.name);
                var safeNameJs = escapeJsStr(quiz.name);
                var safeHashJs = escapeJsStr(quiz.hash);
                var quizCard = document.createElement('div');
                quizCard.className = 'quiz-card-item';
                quizCard.innerHTML = '\
                    <h4>\
                        <span style="font-weight: 700;">' + safeName + '</span>\
                        <button class="btn-secondary" style="background-color: transparent;" onclick="deleteQuiz(\'' + safeNameJs + '\', \'' + safeHashJs + '\')">\
                            <span class="material-icons" style="font-size: 18px; color: var(--color-text-secondary);">delete</span>\
                        </button>\
                    </h4>\
                    <p>总题数: ' + quiz.questionCount + '</p>\
                    <p style="font-style: italic;">' + progressText + '</p>\
                    <div class="quiz-actions">\
                        <button class="cta-btn cta-primary" style="padding: 10px 15px; font-size: 0.9em; flex-grow: 1;" onclick="startQuiz(\'' + safeNameJs + '\')">\
                            <span class="material-icons" style="font-size: 18px; margin-right: 5px;">play_arrow</span> ' + startBtnText + '\
                        </button>\
                    </div>\
                ';
                quizListContainer.appendChild(quizCard);
            });

            if (isQuizListCollapsed) {
                quizListScrollWrapper.classList.add('collapsed');
                if (quizListCollapseBtn) {
                    quizListCollapseBtn.querySelector('.material-icons').textContent = 'unfold_more';
                }
                if (quizListCollapseText) {
                    quizListCollapseText.textContent = '展开题库列表';
                }
            } else {
                quizListScrollWrapper.classList.remove('collapsed');
                if (quizListCollapseBtn) {
                    quizListCollapseBtn.querySelector('.material-icons').textContent = 'unfold_less';
                }
                if (quizListCollapseText) {
                    quizListCollapseText.textContent = '收起题库列表';
                }
            }
        }

        // V20.0: 统计页面 — 按题库归类折叠（Accordion）
        function renderStatsPage() {
            var quizList = getQuizList();
            historyListContent.innerHTML = '';
            lastScoreDisplay.textContent = '--';
            document.getElementById('global-stats').textContent = '--';

            if (quizList.length === 0) {
                historyListContent.innerHTML = '<p style="color: var(--color-text-secondary);">请先导入题库以查看统计和历史记录。</p>';
                return;
            }

            var globalAnswered = 0;
            var globalTotalQuestions = 0;
            var hasAnyHistory = false;

            quizList.forEach(function(quiz, quizIdx) {
                var historyKey = 'HISTORY_' + quiz.name + '_' + quiz.hash;
                var history = JSON.parse(localStorage.getItem(historyKey));
                globalTotalQuestions += quiz.questionCount;

                var activeKey = 'PROGRESS_' + quiz.name + '_' + quiz.hash;
                var savedData = localStorage.getItem(activeKey);

                if (savedData) {
                    try {
                        var data = JSON.parse(savedData);
                        if (data.userAnswers && Array.isArray(data.userAnswers)) {
                            globalAnswered += data.userAnswers.filter(function(a) {
                                return hasAnswered(a);
                            }).length;
                        }
                    } catch(e) {}
                }

                if (history && history.length > 0) {
                    hasAnyHistory = true;

                    // 创建折叠卡片容器
                    var accordion = document.createElement('div');
                    accordion.className = 'stats-accordion';

                    // 折叠卡片头部
                    var header = document.createElement('div');
                    header.className = 'stats-accordion-header';
                    header.onclick = function() { toggleAccordion(this); };
                    header.innerHTML = '\
                        <span class="material-icons accordion-icon">chevron_right</span>\
                        <span class="accordion-title">' + quiz.name + '</span>\
                        <span class="accordion-badge">最近 ' + history.length + ' 次</span>\
                    ';

                    // 折叠卡片内容区
                    var body = document.createElement('div');
                    body.className = 'stats-accordion-body';

                    // 渲染该题库的最近5次历史记录
                    history.forEach(function(record, hIdx) {
                        var total = record.quizData.length;
                        var correctCount = 0;

                        record.quizData.forEach(function(q, qIdx) {
                            if (checkAnswer(q, record.userAnswers[qIdx])) {
                                correctCount++;
                            }
                        });

                        var wrongCount = total - correctCount;
                        var score = ((correctCount / total) * 100).toFixed(1);
                        var timeStr = new Date(record.seconds * 1000).toISOString().substr(11, 8);
                        var dateStr = new Date(record.timestamp).toLocaleString();

                        // 第一个题库的第一条记录作为"上次测试得分"
                        if (quizIdx === 0 && hIdx === 0) {
                            lastScoreDisplay.innerHTML = score + '分 (用时 ' + timeStr + ')';
                            lastScoreDisplay.style.color = score >= 80 ? 'var(--color-primary)' : 'var(--color-wrong)';
                        }

                        var safeNameJs2 = escapeJsStr(quiz.name);
                        var safeHashJs2 = escapeJsStr(quiz.hash);
                        var historyCard = document.createElement('div');
                        historyCard.className = 'history-card';
                        historyCard.innerHTML = '\
                            <button class="delete-history-btn" onclick="event.stopPropagation(); deleteHistoryRecord(\'' + safeNameJs2 + '\', \'' + safeHashJs2 + '\', ' + hIdx + ', this)" title="删除此条记录">\
                                <span class="material-icons">delete</span>\
                            </button>\
                            <p style="margin: 0; font-size: 0.9em; padding-right: 35px;">\
                                <strong>得分: <span style="color: ' + (score >= 80 ? 'var(--color-primary)' : 'var(--color-wrong)') + ';">' + score + '分</span></strong> \
                                | 对/错: ' + correctCount + '/' + wrongCount + ' \
                                | 用时: ' + timeStr + ' \
                                <br>\
                                <span style="font-size: 0.8em; color: #999;">' + dateStr + '</span>\
                            </p>\
                            <div style="display: flex; gap: 10px; margin-top: 10px;">\
                                <button onclick="reviewHistoricalQuiz(\'' + safeNameJs2 + '\', \'' + safeHashJs2 + '\', ' + hIdx + ')" class="btn-secondary" style="background-color: var(--color-primary); color: white;">\
                                    🔎 回顾错题\
                                </button>\
                                <button onclick="startReviewWrongQuiz(\'' + safeNameJs2 + '\', \'' + safeHashJs2 + '\', ' + hIdx + ')" class="btn-secondary" style="background-color: var(--color-wrong); color: white;" ' + (wrongCount === 0 ? 'disabled' : '') + '>\
                                    🔄 重做错题 (' + wrongCount + ')\
                                </button>\
                            </div>\
                        ';
                        body.appendChild(historyCard);
                    });

                    accordion.appendChild(header);
                    accordion.appendChild(body);
                    historyListContent.appendChild(accordion);
                }
            });

            if (!hasAnyHistory) {
                historyListContent.innerHTML = '<p style="color: var(--color-text-secondary);">暂无历史记录。请先完成一次答题。</p>';
            }

            document.getElementById('global-stats').textContent = '总题库: ' + quizList.length + ' 个 | 总题数: ' + globalTotalQuestions + ' 题 | 已答题: ' + globalAnswered + ' 题';
        }

        // V20.0: 静默刷新全局统计数据（不重绘整个页面）
        function refreshGlobalStats() {
            if (appState !== 'Stats') return;
            var quizList = getQuizList();
            var globalAnswered = 0;
            var globalTotalQuestions = 0;
            quizList.forEach(function(quiz) {
                globalTotalQuestions += quiz.questionCount;
                var activeKey = 'PROGRESS_' + quiz.name + '_' + quiz.hash;
                var savedData = localStorage.getItem(activeKey);
                if (savedData) {
                    try {
                        var data = JSON.parse(savedData);
                        if (data.userAnswers && Array.isArray(data.userAnswers)) {
                            globalAnswered += data.userAnswers.filter(function(a) { return hasAnswered(a); }).length;
                        }
                    } catch(e) {}
                }
            });
            document.getElementById('global-stats').textContent = '总题库: ' + quizList.length + ' 个 | 总题数: ' + globalTotalQuestions + ' 题 | 已答题: ' + globalAnswered + ' 题';

            // 更新上次得分（取第一条记录）
            var hasHistory = false;
            for (var i = 0; i < quizList.length; i++) {
                var key = 'HISTORY_' + quizList[i].name + '_' + quizList[i].hash;
                var hist = JSON.parse(localStorage.getItem(key));
                if (hist && hist.length > 0) {
                    var r = hist[0];
                    var total = r.quizData.length;
                    var correct = 0;
                    r.quizData.forEach(function(q, idx) { if (checkAnswer(q, r.userAnswers[idx])) correct++; });
                    var sc = ((correct / total) * 100).toFixed(1);
                    var ts = new Date(r.seconds * 1000).toISOString().substr(11, 8);
                    lastScoreDisplay.innerHTML = sc + '分 (用时 ' + ts + ')';
                    lastScoreDisplay.style.color = sc >= 80 ? 'var(--color-primary)' : 'var(--color-wrong)';
                    hasHistory = true;
                    break;
                }
            }
            if (!hasHistory) {
                lastScoreDisplay.textContent = '--';
                lastScoreDisplay.style.color = 'var(--color-primary)';
            }
        }

        function initQuizUI() {
            if (quizData.length === 0) {
                setAppState('Home');
                return;
            }

            resultSummaryDiv.style.display = 'none';

            if (isExamFinished) {
                stopTimer();
                var c = 0; quizData.forEach(function(q, i) { if (checkAnswer(q, userAnswers[i])) c++; });
                displayResultSummaryWithData(quizData.length, c);
            } else {
                startTimer();
            }

            initAnswerCard();
            // V20.0: 保持当前题号不变（静默恢复时不会跳回第1题）
            if (currentQuestionIndex >= quizData.length) {
                currentQuestionIndex = 0;
            }
            renderQuestion(currentQuestionIndex);
        }

        function handleSubmit() {
            if (isExamFinished) return;

            stopTimer();
            clearAutoAdvanceTimer();
            isExamFinished = true;
            submitBtn.style.display = 'none';

            var totalQuestions = quizData.length;
            var correctTally = 0;

            quizData.forEach(function(q, index) {
                updateCardStatus(index + 1, userAnswers[index]);
                if (checkAnswer(q, userAnswers[index])) correctTally++;
            });

            var displayContainer = questionDisplayArea.querySelector('#current-question-display');
            if (displayContainer) displayContainer.remove();

            saveHistory(userAnswers, seconds);
            localStorage.removeItem('PROGRESS_' + currentQuizName + '_' + currentQuizHash);

            displayResultSummaryWithData(totalQuestions, correctTally);

            var wrongData = [];
            var wrongAnswers = [];
            quizData.forEach(function(q, idx) {
                if (!checkAnswer(q, userAnswers[idx])) {
                    wrongData.push(q);
                    wrongAnswers.push(userAnswers[idx]);
                }
            });
            quizData = wrongData;
            userAnswers = wrongAnswers;

            setAppState('Review');

            if (quizData.length > 0) {
                currentQuestionIndex = 0;
                renderQuestion(0);
            }

            if (window.innerWidth <= 768) toggleAnswerCard(false);
        }

        function displayResultSummaryWithData(total, correctCount) {
            var wrongCount = total - correctCount;
            var score = ((correctCount / total) * 100).toFixed(1);
            var timeStr = new Date(seconds * 1000).toISOString().substr(11, 8);

            var safeQuizName = escapeHtml(currentQuizName || '未知');
            var summaryHtml = '\
                <h2>考试结果 🎉</h2>\
                <p>题库：<strong style="color: var(--color-secondary);">' + safeQuizName + '</strong></p>\
                <p>总用时：<strong style="color: var(--color-text-main);">' + timeStr + '</strong></p>\
                <p>总题数：<strong>' + total + '</strong></p>\
                <p><strong>最终得分：<span style="font-size: 1.5em; color: ' + (score >= 80 ? 'var(--color-primary)' : 'var(--color-wrong)') + ';">' + score + '分</span></strong></p>\
                <p>答对题数：<strong style="color: var(--color-correct);">' + correctCount + '</strong></p>\
                <p>答错题数：<strong style="color: var(--color-wrong);">' + wrongCount + '</strong></p>\
            ';

            resultSummaryDiv.innerHTML = summaryHtml;
            resultSummaryDiv.style.display = 'block';
        }

        // =========================================================
        // V15.0: 自动跳转定时器管理
        // =========================================================

        function clearAutoAdvanceTimer() {
            if (autoAdvanceTimer) {
                clearTimeout(autoAdvanceTimer);
                autoAdvanceTimer = null;
            }
        }

        function scheduleAutoAdvance() {
            clearAutoAdvanceTimer();
            if (!isMemorizeMode || !isAutoAdvance || isExamFinished) return;
            if (currentQuestionIndex >= quizData.length - 1) return;

            var delay = 500 + Math.floor(Math.random() * 300);
            autoAdvanceTimer = setTimeout(function() {
                if (_wrongQueue && _wrongQueue.length > 0) {
                    goToNextQuestion();
                } else if (!_wrongQueue && currentQuestionIndex < quizData.length - 1) {
                    goToNextQuestion();
                }
            }, delay);
        }

        // =========================================================
        // 核心：渲染题目 (V15.0 - 集成滑动切题)
        // =========================================================

        function renderQuestion(index) {
            clearAutoAdvanceTimer();
            window.scrollTo(0, 0);

            // 错题回插：用队列第一项覆盖
            if (_wrongQueue && _wrongQueue.length > 0) {
                index = _wrongQueue[0];
            } else if (_wrongQueue && _wrongQueue.length === 0 && !isExamFinished) {
                // 队列空 = 全部答对
                handleSubmit();
                return;
            }

            currentQuestionIndex = index;
            var questionData = quizData[index];
            if (!questionData) return;
            // 防御：校验题目数据完整性
            if (!questionData.question || !questionData.options || questionData.options.length < 2) {
                showToast('第' + (index + 1) + '题数据异常，已跳过', 'warn');
                if (index < quizData.length - 1) { renderQuestion(index + 1); }
                return;
            }

            resultSummaryDiv.style.display = 'none';

            var oldContainer = questionDisplayArea.querySelector('#current-question-display');
            if (oldContainer) oldContainer.remove();

            var displayContainer = document.createElement('div');
            displayContainer.id = 'current-question-display';

            var container = document.createElement('div');
            container.className = 'question-container';

            var title = document.createElement('div');
            title.className = 'question-title';
            var typeHint = questionData.type.indexOf('多选') !== -1 ? ' <span class="multi-hint">可多选</span>' : '';
            title.innerHTML = (index + 1) + '. [' + escapeHtml(questionData.type) + ']' + typeHint + ' ' + escapeHtml(questionData.question);
            container.appendChild(title);

            var optionsToRender = questionData.shuffledOptions || questionData.options;

            optionsToRender.forEach(function(option) {
                var optionDiv = document.createElement('div');
                optionDiv.className = 'option-item';
                optionDiv.textContent = option.label + ' ' + option.text;

                var optionLetter = option.label[0];
                optionDiv.dataset.optionValue = optionLetter;

                var userAnswer = userAnswers[index];

                var isSelected = questionData.type.indexOf('多选') !== -1
                    ? userAnswer && Array.isArray(userAnswer) && userAnswer.indexOf(optionLetter) !== -1
                    : userAnswer === optionLetter;

                if (isSelected) {
                    optionDiv.classList.add('selected');
                }

                // 背题模式 - 在渲染时就直接应用高亮并锁定
                if (isMemorizeMode && !isExamFinished && hasAnswered(userAnswer)) {
                    var isCorrectOption = questionData.answerKey.indexOf(optionLetter) !== -1;
                    if (isCorrectOption) {
                        optionDiv.classList.add('memorize-correct');
                    }
                    if (isSelected && !isCorrectOption) {
                        optionDiv.classList.add('memorize-wrong');
                    }
                    optionDiv.classList.add('memorize-disabled');
                }

                if (isExamFinished) {
                    var isCorrectOptionReview = questionData.answerKey.indexOf(optionLetter) !== -1;
                    if (isCorrectOptionReview) {
                        optionDiv.classList.add('correct-answer-bg');
                    }
                    if (isSelected && !isCorrectOptionReview) {
                        optionDiv.classList.add('wrong-selected-bg');
                    }
                    optionDiv.style.cursor = 'default';
                } else {
                    optionDiv.addEventListener('click', function(e) {
                        var selectedLetter = e.currentTarget.dataset.optionValue;
                        handleOptionClick(index, selectedLetter, e.currentTarget);
                        saveActiveProgress();
                    });
                }

                container.appendChild(optionDiv);
            });

            // 背题模式 - 若已作答，渲染时自动显示反馈
            if (isMemorizeMode && !isExamFinished) {
                var userAns = userAnswers[index];
                if (hasAnswered(userAns)) {
                    applyMemorizeFeedback(index);
                }
            }

            if (isExamFinished && questionData.analysis) {
                var analysisDiv = document.createElement('div');
                analysisDiv.className = 'review-analysis';
                analysisDiv.innerHTML = '<br><strong>【解析】</strong> ' + escapeHtml(questionData.analysis);
                container.appendChild(analysisDiv);
            }

            displayContainer.appendChild(container);

            questionDisplayArea.innerHTML = '';
            questionDisplayArea.appendChild(displayContainer);

            updateCardStatus(index + 1, userAnswers[index]);
            updateCardToggleText();

            attachSwipeListeners(displayContainer);
        }

        // V20.1: 竞态锁 — 同一题背题判定期间拦截所有并发点击
        var _memorizeLockIndex = -1;
        function handleOptionClick(qIndex, selectedLabel, clickedDiv) {
            clearAutoAdvanceTimer();

            var questionData = quizData[qIndex];

            // 背题模式下：已作答 或 正在判定中 均拦截后续点击
            if (isMemorizeMode && !isExamFinished) {
                if (hasAnswered(userAnswers[qIndex]) || _memorizeLockIndex === qIndex) {
                    return;
                }
            }

            if (questionData.type.indexOf('多选') !== -1) {
                if (Array.isArray(userAnswers[qIndex]) && userAnswers[qIndex].indexOf(selectedLabel) !== -1) {
                    userAnswers[qIndex] = userAnswers[qIndex].filter(function(l) { return l !== selectedLabel; });
                    clickedDiv.classList.remove('selected');
                } else {
                    if (!Array.isArray(userAnswers[qIndex])) userAnswers[qIndex] = [];
                    userAnswers[qIndex].push(selectedLabel);
                    clickedDiv.classList.add('selected');
                }
            } else {
                var optionItems = clickedDiv.parentNode.querySelectorAll('.option-item');
                optionItems.forEach(function(item) { item.classList.remove('selected'); });
                userAnswers[qIndex] = selectedLabel;
                clickedDiv.classList.add('selected');
            }

            // 背题模式 - 即时判定（加竞态锁）
            if (isMemorizeMode && !isExamFinished) {
                _memorizeLockIndex = qIndex;
                try {
                    applyMemorizeFeedback(qIndex);

                    // V15.0: 答对自动跳转
                    var isCorrect = checkAnswer(questionData, userAnswers[qIndex]);
                    if (isCorrect && isAutoAdvance) {
                        scheduleAutoAdvance();
                    }

                    // 锁定所有选项，禁止二次点击
                    var optionItems = clickedDiv.parentNode.querySelectorAll('.option-item');
                    for (var oi = 0; oi < optionItems.length; oi++) {
                        optionItems[oi].classList.add('memorize-disabled');
                    }
                } finally {
                    _memorizeLockIndex = -1;
                }

                // 错题回插：答错时随机插回队列
                if (isWrongReinsert && _wrongQueue) {
                    var isRight = checkAnswer(questionData, userAnswers[qIndex]);
                    if (isRight) {
                        _wrongQueue.shift();
                    } else {
                        var cur = _wrongQueue.shift();
                        var pos = _wrongQueue.length > 0 ? Math.floor(Math.random() * (_wrongQueue.length + 1)) : 0;
                        _wrongQueue.splice(pos, 0, cur);
                    }
                }
            }

            updateCardStatus(qIndex + 1, userAnswers[qIndex]);
            updateCardToggleText();
        }

        // =========================================================
        // V15.0: 滑动切题（触摸 + 鼠标拖拽）
        // =========================================================
        var swipeStartX = 0;
        var swipeStartY = 0;
        var swipeActive = false;
        var swipeMinDistance = (window.innerWidth <= 768) ? 30 : 50;

        function attachSwipeListeners(container) {
            container.addEventListener('touchstart', function(e) {
                if (e.touches.length === 1) {
                    swipeStartX = e.touches[0].clientX;
                    swipeStartY = e.touches[0].clientY;
                    swipeActive = true;
                }
            }, { passive: true });

            container.addEventListener('touchend', function(e) {
                if (!swipeActive) return;
                swipeActive = false;
                var deltaX = (e.changedTouches[0].clientX - swipeStartX);
                var deltaY = (e.changedTouches[0].clientY - swipeStartY);
                handleSwipe(deltaX, deltaY);
            });

            container.addEventListener('mousedown', function(e) {
                if (e.target.closest('button') || e.target.closest('.option-item')) return;
                swipeStartX = e.clientX;
                swipeStartY = e.clientY;
                swipeActive = true;
                e.preventDefault();
            });

            container.addEventListener('mouseup', function(e) {
                if (!swipeActive) return;
                swipeActive = false;
                var deltaX = (e.clientX - swipeStartX);
                var deltaY = (e.clientY - swipeStartY);
                handleSwipe(deltaX, deltaY);
            });

            container.addEventListener('mouseleave', function() {
                swipeActive = false;
            });
        }

        function handleSwipe(deltaX, deltaY) {
            if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > swipeMinDistance) {
                if (deltaX < 0) {
                    var canNext = _wrongQueue ? (_wrongQueue.length > 0) : (currentQuestionIndex < quizData.length - 1);
                    if (canNext) { clearAutoAdvanceTimer(); renderQuestion(currentQuestionIndex + 1); }
                } else if (deltaX > 0) {
                    var canPrev = !_wrongQueue && currentQuestionIndex > 0;
                    if (canPrev) { clearAutoAdvanceTimer(); renderQuestion(currentQuestionIndex - 1); }
                }
            }
        }

        // =========================================================
        // 背题模式即时反馈
        // =========================================================

        // V21.0: 背题模式下仅高亮选项红绿色，不显示文字反馈
        function applyMemorizeFeedback(qIndex) {
            var questionData = quizData[qIndex];
            var userAnswer = userAnswers[qIndex];
            var container = questionDisplayArea.querySelector('#current-question-display .question-container');
            if (!container) return;
            if (!hasAnswered(userAnswer)) return;

            var allOptions = container.querySelectorAll('.option-item');
            allOptions.forEach(function(opt) {
                opt.classList.remove('memorize-correct', 'memorize-wrong');
                var letter = opt.dataset.optionValue;
                var isCorrectOption = questionData.answerKey.indexOf(letter) !== -1;
                var isSelected = questionData.type.indexOf('多选') !== -1
                    ? Array.isArray(userAnswer) && userAnswer.indexOf(letter) !== -1
                    : userAnswer === letter;
                if (isCorrectOption) opt.classList.add('memorize-correct');
                if (isSelected && !isCorrectOption) opt.classList.add('memorize-wrong');
            });
        }

        function initAnswerCard() {
            cardGrid.innerHTML = '';
            quizData.forEach(function(question, index) {
                var cardItem = document.createElement('div');
                cardItem.dataset.content = index + 1;
                cardItem.className = 'card-item status-default';
                cardItem.id = 'card-item-' + (index + 1);

                cardItem.addEventListener('click', function() {
                    clearAutoAdvanceTimer();
                    renderQuestion(index);
                    if (window.innerWidth <= 768 && isCardVisible) {
                        toggleAnswerCard();
                    }
                });

                cardGrid.appendChild(cardItem);
            });
            quizData.forEach(function(_, index) {
                updateCardStatus(index + 1, userAnswers[index]);
            });
        }

        function updateCardStatus(questionNumber, userAnswer) {
            var cardItem = document.getElementById('card-item-' + questionNumber);
            if (!cardItem) return;

            cardItem.classList.remove('status-default', 'status-answered', 'status-correct', 'status-wrong');

            var questionData = quizData[questionNumber - 1];
            if (!questionData) return;

            // V21.0: 背题模式即时显示对错颜色
            if (isMemorizeMode && hasAnswered(userAnswer)) {
                var isRight = checkAnswer(questionData, userAnswer);
                cardItem.classList.add(isRight ? 'status-correct' : 'status-wrong');
            } else if (isExamFinished) {
                var isCorrect = checkAnswer(questionData, userAnswer);
                cardItem.classList.add(isCorrect ? 'status-correct' : 'status-wrong');
            } else {
                var ans = hasAnswered(userAnswer);
                cardItem.classList.add(ans ? 'status-answered' : 'status-default');
            }
        }

        window.goToPreviousQuestion = function() {
            clearAutoAdvanceTimer();
            if (_wrongQueue) return; // 错题回插模式禁用回退
            if (currentQuestionIndex > 0) {
                renderQuestion(currentQuestionIndex - 1);
            }
        };

        window.goToNextQuestion = function() {
            clearAutoAdvanceTimer();
            if (_wrongQueue && _wrongQueue.length > 0) {
                renderQuestion(_wrongQueue[0]);
            } else if (!_wrongQueue && currentQuestionIndex < quizData.length - 1) {
                renderQuestion(currentQuestionIndex + 1);
            }
        };

        window.toggleAnswerCard = function(forceState) {
            var isMobile = window.innerWidth <= 768;

            if (forceState !== undefined) {
                isCardVisible = forceState;
            } else {
                isCardVisible = !isCardVisible;
            }

            if (isMobile) {
                if (isCardVisible) {
                    answerCardArea.classList.add('visible');
                } else {
                    answerCardArea.classList.remove('visible');
                }
            } else {
                answerCardArea.classList.add('visible');
                isCardVisible = true;
            }

            updateCardToggleText();
        };

        function updateCardToggleText() {
            if (quizData.length === 0) {
                cardToggleButton.textContent = '答题卡 (0/0)';
                return;
            }

            var answeredCount = userAnswers.filter(function(answer) {
                return hasAnswered(answer);
            }).length;
            var total = quizData.length;

            var text = isCardVisible ? '收起答题卡' : '答题卡';
            text += ' (' + answeredCount + '/' + total + ')';

            cardToggleButton.textContent = text;
        }

        document.addEventListener('DOMContentLoaded', function() {
            // V20.0: 加载持久化设置并同步UI
            loadSettings();
            applySettingsToUI();

            var isMobile = window.innerWidth <= 768;
            if (!isMobile) {
                bottomNav.style.display = 'none';
                answerCardArea.style.position = 'sticky';
                answerCardArea.style.top = '30px';
                answerCardArea.classList.add('visible');
                isCardVisible = true;
            } else {
                answerCardArea.style.position = 'fixed';
                answerCardArea.classList.remove('visible');
                isCardVisible = false;
            }

            // V17.0: 设置抽屉初始关闭状态
            isDrawerOpen = false;
            settingsDrawer.classList.remove('visible');
            drawerOverlay.classList.remove('visible');
            document.body.style.overflow = '';

            // V17.0: 题库列表折叠初始状态
            isQuizListCollapsed = false;
            quizListScrollWrapper.classList.remove('collapsed');

            // V20.1: localStorage 可用性检测
            try {
                var testKey = '_reasonix_storage_test_';
                localStorage.setItem(testKey, '1');
                localStorage.removeItem(testKey);
            } catch (e) {
                showToast('⚠️ 浏览器本地存储不可用（可能处于隐私模式），题库和进度将无法保存', 'error');
            }

            // 启动自检：清理损坏的题库数据
            try {
                var quizList = JSON.parse(localStorage.getItem(QUIZ_LIST_KEY) || '[]');
                var cleaned = quizList.filter(function(q) {
                    if (!q.name || !q.hash || !q.dataKey) return false;
                    var raw = localStorage.getItem(q.dataKey);
                    if (!raw) return false;
                    return true;
                });
                if (cleaned.length < quizList.length) {
                    localStorage.setItem(QUIZ_LIST_KEY, JSON.stringify(cleaned));
                    showToast('已自动清理 ' + (quizList.length - cleaned.length) + ' 条损坏的题库记录', 'warn');
                }
            } catch (e) {}

            setAppState('Home');
        });

        function startTimer() {
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(function() {
                seconds++;
                timeDisplay.textContent = new Date(seconds * 1000).toISOString().substr(11, 8);
                saveActiveProgress();
            }, 1000);
        }

        function stopTimer() {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }

        // =========================================================
        // F. 文件上传与多格式解析 (V11.0)
        // =========================================================

        async function readTextFileWithEncoding(file) {
            try {
                var text = await readFileAsText(file, 'UTF-8');
                if (!text.includes('') && !hasGarbledText(text)) {
                    return text;
                }
            } catch (e) {
                console.log('UTF-8 读取失败，尝试其他编码');
            }

            try {
                var text = await readFileAsText(file, 'GBK');
                return text;
            } catch (e) {
                console.log('GBK 读取失败，尝试 GB18030');
            }

            try {
                var text = await readFileAsText(file, 'GB18030');
                return text;
            } catch (e) {
                console.log('GB18030 读取失败');
            }

            try {
                var text = await readFileAsText(file, 'ISO-8859-1');
                return text;
            } catch (e) {
                throw new Error('无法识别文件编码');
            }
        }

        function readFileAsText(file, encoding) {
            return new Promise(function(resolve, reject) {
                var reader = new FileReader();
                reader.onload = function(e) { resolve(e.target.result); };
                reader.onerror = function(e) { reject(e); };
                reader.readAsText(file, encoding);
            });
        }

        function hasGarbledText(text) {
            var garbledPatterns = [
                /[\x00-\x08\x0B\x0C\x0E-\x1F]/,
                /锟斤拷/,
                /烫烫烫/,
                /屯屯屯/
            ];
            return garbledPatterns.some(function(pattern) { return pattern.test(text); });
        }

        async function parsePDFFile(file) {
            showLoading('正在解析 PDF 文件...');

            try {
                var arrayBuffer = await file.arrayBuffer();
                var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

                var fullText = '';
                var numPages = pdf.numPages;

                for (var i = 1; i <= numPages; i++) {
                    loadingText.textContent = '正在解析 PDF 第 ' + i + '/' + numPages + ' 页...';
                    var page = await pdf.getPage(i);
                    var textContent = await page.getTextContent();
                    var pageText = textContent.items.map(function(item) { return item.str; }).join(' ');
                    fullText += pageText + '\n';
                }

                return fullText;
            } catch (e) {
                console.error('PDF 解析错误:', e);
                throw new Error('PDF 文件解析失败: ' + e.message);
            }
        }

        async function parseWordFile(file) {
            showLoading('正在解析 Word 文件...');

            try {
                var arrayBuffer = await file.arrayBuffer();
                var result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                return result.value;
            } catch (e) {
                console.error('Word 解析错误:', e);
                throw new Error('Word 文件解析失败: ' + e.message);
            }
        }

        // V20.1: 单例文件选择器，每次复用同一个 input，不再反复创建
        var _cachedFileInput = null;
        window.uploadNewFile = function() {
            if (isDrawerOpen) {
                toggleSettingsDrawer();
            }

            if (!_cachedFileInput) {
                _cachedFileInput = document.createElement('input');
                _cachedFileInput.type = 'file';
                _cachedFileInput.id = 'quiz-file-input';
                _cachedFileInput.accept = '.txt,.docx,.pdf';
                _cachedFileInput.style.display = 'none';
                document.body.appendChild(_cachedFileInput);

                _cachedFileInput.onchange = async function(event) {
                    var file = event.target.files[0];
                    if (!file) return;

                    var fileName = file.name;
                    var fileExt = fileName.split('.').pop().toLowerCase();
                    var baseName = fileName.replace(/\.(txt|docx|pdf)$/i, '');

                    try {
                        var rawText = '';

                        if (fileExt === 'txt') {
                            showLoading('正在读取文本文件...');
                            rawText = await readTextFileWithEncoding(file);
                        } else if (fileExt === 'docx') {
                            if (typeof mammoth === 'undefined') { hideLoading(); showToast('Word 解析组件未加载，请检查网络连接', 'error'); return; }
                            rawText = await parseWordFile(file);
                        } else if (fileExt === 'pdf') {
                            if (typeof pdfjsLib === 'undefined') { hideLoading(); showToast('PDF 解析组件未加载，请检查网络连接', 'error'); return; }
                            rawText = await parsePDFFile(file);
                        } else {
                            alert('不支持的文件格式，请上传 .txt、.docx 或 .pdf 文件。');
                            hideLoading();
                            return;
                        }

                        hideLoading();
                        startImportProcess(rawText, baseName);

                    } catch (e) {
                        hideLoading();
                        alert('文件读取失败: ' + e.message);
                    }

                    event.target.value = null;
                };
            }
            _cachedFileInput.click();
        };

        function startImportProcess(rawText, filename) {
            var quizName = filename || "未命名题库";

            var tempQuizData = parseQuizText(rawText);

            if (tempQuizData.length > 0) {
                saveQuizToList(quizName, rawText, tempQuizData);

                alert('成功导入 ' + tempQuizData.length + ' 道题目，已命名为「' + quizName + '」。请在首页选择开始答题。');
                setAppState('Home');
            } else {
                alert("解析题库失败，未识别到有效题目。\n\n请检查文件格式：\n1. 题号以数字开头（如 1.）\n2. 选项以大写字母开头（如 A.）\n3. 有「正确答案:X」或「答案：X」行");
                setAppState('Home');
            }
        }

        window.clearLocalStorageAndReload = function() {
            if (confirm("警告：这将清除所有已导入的题库、进度和历史记录。确定要继续吗？")) {
                localStorage.clear();
                location.reload();
            }
        };

        submitBtn.addEventListener('click', handleSubmit);

        // 全局异常捕获：出错时 toast 提示而非静默崩溃
        window.onerror = function(msg) {
            showToast('程序异常，请刷新页面后重试', 'error');
            return true;
        };

        // 解析器自测：用标准题库文本验证解析结果
        (function(){
            var test = '1. 中国的首都是？\nA. 上海\nB. 北京\nC. 广州\nD. 深圳\n正确答案:B\n解析：选B。\n\n一、多选题\n2. 可再生能源？\nA. 太阳能\nB. 煤炭\nC. 风能\n正确答案:AC';
            var r = parseQuizText(test);
            if (r.length !== 2) console.warn('解析器自测失败：题目数 ' + r.length + '，期望 2');
            else if (r[0].answerKey !== 'B') console.warn('解析器自测失败：第1题答案 ' + r[0].answerKey + '，期望 B');
            else if (r[0].options.length !== 4) console.warn('解析器自测失败：第1题选项数 ' + r[0].options.length);
            else if (r[1].type !== '多选题') console.warn('解析器自测失败：第2题类型 ' + r[1].type);
            else if (r[1].answerKey !== 'AC') console.warn('解析器自测失败：第2题答案 ' + r[1].answerKey);
        })();