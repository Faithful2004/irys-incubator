    // JavaScript
    // Line 1: Initialize particles.js
    particlesJS('particles-js', {
        particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: '#10FDFA' },
            shape: { type: 'circle' },
            opacity: { value: 0.5, random: false },
            size: { value: 3, random: true },
            line_linked: { enable: true, distance: 150, color: '#10FDFA', opacity: 0.4, width: 1 },
            move: { enable: true, speed: 6, direction: 'none', random: false, straight: false, out_mode: 'out', bounce: false }
        },
        interactivity: {
            detect_on: 'canvas',
            events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' }, resize: true },
            modes: { repulse: { distance: 100, duration: 0.4 }, push: { particles_nb: 4 } }
        },
        retina_detect: true
    });

    // Line 18: Constants
    var VOTE_THRESHOLD = 1000;
    var VOTING_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    var STAKE_AMOUNT = 10; // IRYS tokens
    var irys = null;
    var walletAddress = null;

    // Line 24: Wallet connection
    function connectWallet() {
        if (!window.solana) {
            alert('Please install Phantom wallet');
            return false;
        }
        try {
            window.solana.connect().then(function(resp) {
                walletAddress = resp.publicKey.toString();
                document.getElementById('wallet-info').innerText = 'Connected: ' + walletAddress.slice(0, 6) + '...';
                document.getElementById('connect-wallet').style.display = 'none';
                irys = new WebIrys({
                    url: 'https://node2.irys.xyz',
                    token: 'solana',
                    wallet: { provider: window.solana }
                });
                irys.ready().then(function() {
                    console.log('Irys ready for wallet: ' + walletAddress);
                }).catch(function(e) {
                    alert('Irys initialization failed: ' + e.message);
                });
            }).catch(function(e) {
                alert('Wallet connection failed: ' + e.message);
            });
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    // Line 45: Submit suggestion function
    function submitSuggestion() {
        if (!irys) {
            alert('Please connect your wallet first');
            return;
        }
        var twitter = document.getElementById('twitter').value.trim();
        var category = document.getElementById('category').value;
        var title = document.getElementById('title').value.trim();
        var desc = document.getElementById('description').value.trim();
        if (!twitter || !category || !title || !desc) {
            alert('Please fill in all required fields');
            return;
        }
        if (!twitter.startsWith('@')) {
            alert('Twitter handle must start with @');
            return;
        }
        submitToIrys(twitter, category, title, desc, false);
    }

    // Line 61: Boost suggestion function
    function boostSuggestion() {
        if (!irys) {
            alert('Please connect your wallet first');
            return;
        }
        var twitter = document.getElementById('twitter').value.trim();
        var category = document.getElementById('category').value;
        var title = document.getElementById('title').value.trim();
        var desc = document.getElementById('description').value.trim();
        if (!twitter || !category || !title || !desc) {
            alert('Please fill in all required fields');
            return;
        }
        if (!twitter.startsWith('@')) {
            alert('Twitter handle must start with @');
            return;
        }
        document.getElementById('stake-dialog').style.display = 'block';
    }

    // Line 77: Submit to Irys
    function submitToIrys(twitter, category, title, desc, isCohort) {
        var suggestion = {
            id: Date.now().toString(),
            twitter: twitter,
            category: category,
            title: title,
            description: desc,
            submitter: walletAddress || 'Anonymous',
            timestamp: Date.now(),
            votes: 0,
            isCohort: isCohort
        };
        try {
            var data = JSON.stringify(suggestion);
            var tags = [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'App-Name', value: 'IrysIncubator' },
                { name: 'Type', value: 'Suggestion' }
            ];
            irys.upload(data, { tags: tags }).then(function(receipt) {
                suggestion.irysTxId = receipt.id;
                var suggestions = JSON.parse(localStorage.getItem('suggestions') || '[]');
                suggestions.push(suggestion);
                localStorage.setItem('suggestions', JSON.stringify(suggestions));
                alert('Suggestion submitted! Tx ID: ' + receipt.id);
                resetForm();
                fetchSuggestions();
                confetti();
            }).catch(function(e) {
                alert('Submission failed: ' + e.message);
            });
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    // Line 103: Handle staking
    function handleStake() {
        try {
            irys.fund(irys.utils.toAtomic(STAKE_AMOUNT, 'solana')).then(function() {
                var twitter = document.getElementById('twitter').value.trim();
                var category = document.getElementById('category').value;
                var title = document.getElementById('title').value.trim();
                var desc = document.getElementById('description').value.trim();
                document.getElementById('stake-dialog').style.display = 'none';
                submitToIrys(twitter, category, title, desc, true);
            }).catch(function(e) {
                alert('Staking failed: ' + e.message);
                document.getElementById('stake-dialog').style.display = 'none';
            });
        } catch (e) {
            alert('Error: ' + e.message);
            document.getElementById('stake-dialog').style.display = 'none';
        }
    }

    // Line 119: Reset form
    function resetForm() {
        document.getElementById('twitter').value = '';
        document.getElementById('category').value = '';
        document.getElementById('title').value = '';
        document.getElementById('description').value = '';
    }

    // Line 125: Vote on suggestion function
    function voteOnSuggestion(id) {
        var suggestions = JSON.parse(localStorage.getItem('suggestions') || '[]');
        var suggestion = suggestions.find(function(s) { return s.id === id; });
        if (suggestion && !suggestion.isCohort) {
            suggestion.votes = (suggestion.votes || 0) + 1;
            if (suggestion.votes >= VOTE_THRESHOLD) {
                suggestion.isCohort = true;
                alert('Congratulations! This suggestion has graduated to the Incubator Cohort!');
            }
            localStorage.setItem('suggestions', JSON.stringify(suggestions));
            if (irys) {
                var voteData = id;
                var tags = [
                    { name: 'Content-Type', value: 'text/plain' },
                    { name: 'App-Name', value: 'IrysIncubator' },
                    { name: 'Type', value: 'Vote' },
                    { name: 'Suggestion-ID', value: id }
                ];
                irys.upload(voteData, { tags: tags }).then(function(receipt) {
                    alert('Voted! Tx ID: ' + receipt.id);
                    fetchSuggestions();
                    confetti();
                }).catch(function(e) {
                    alert('Vote submission failed: ' + e.message);
                });
            } else {
                alert('Voted!');
                fetchSuggestions();
                confetti();
            }
        }
    }

    // Line 152: Fetch suggestions function
    function fetchSuggestions() {
        var suggestions = JSON.parse(localStorage.getItem('suggestions') || '[]');
        suggestions.sort(function(a, b) { return (b.votes || 0) - (a.votes || 0); }); // Line 154
        var now = Date.now();
        suggestions.forEach(function(s) {
            if (!s.isCohort && (now - s.timestamp) > VOTING_PERIOD_MS) {
                s.expired = true;
            }
        });
        displaySuggestions(suggestions);
    }

    // Line 161: Display suggestions function
    function displaySuggestions(suggestions) {
        var suggestionList = document.getElementById('suggestions-list');
        var cohortList = document.getElementById('cohort-list');
        suggestionList.innerHTML = '';
        cohortList.innerHTML = '';
        suggestions.forEach(function(sug) {
            var timeLeft = VOTING_PERIOD_MS - (Date.now() - sug.timestamp);
            var daysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000));
            var card = document.createElement('div');
            card.className = 'card' + (sug.isCohort ? ' cohort' : '');
            card.innerHTML = `
                <h3>${sug.title}</h3>
                <p class="category">${sug.category}</p>
                <p>${sug.description}</p>
                <p>Submitted by: ${sug.twitter}</p>
                <p class="votes">Votes: ${sug.votes || 0}</p>
                ${sug.isCohort ? '<p class="cohort-status">In Incubator Cohort!</p>' :
                    (sug.expired ? '<p class="time-left">Expired</p>' :
                    `<p class="time-left">${daysLeft > 0 ? daysLeft + ' days left' : 'Expiring soon'}</p>
                    <button onclick="voteOnSuggestion('${sug.id}')">Vote</button>`)}
            `;
            if (sug.isCohort) {
                cohortList.appendChild(card);
            } else if (!sug.expired) {
                suggestionList.appendChild(card);
            }
        });
    }

    // Line 184: Confetti animation function
    function confetti() {
        var duration = 3 * 1000;
        var animationEnd = Date.now() + duration;
        var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        if (typeof window.confetti !== 'function') {
            console.warn('Confetti library not loaded yet');
            return;
        }

        var interval = setInterval(function() {
            var timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) {
                clearInterval(interval);
                return;
            }
            var particleCount = 50 * (timeLeft / duration);
            window.confetti({
                particleCount: particleCount,
                startVelocity: defaults.startVelocity,
                spread: defaults.spread,
                ticks: defaults.ticks,
                zIndex: defaults.zIndex,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
            });
            window.confetti({
                particleCount: particleCount,
                startVelocity: defaults.startVelocity,
                spread: defaults.spread,
                ticks: defaults.ticks,
                zIndex: defaults.zIndex,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
            });
        }, 250);
    }

    // Line 214: Initialize
    document.getElementById('connect-wallet').addEventListener('click', connectWallet);
    document.getElementById('submit').addEventListener('click', submitSuggestion);
    document.getElementById('boost').addEventListener('click', boostSuggestion);
    document.getElementById('proceed-stake').addEventListener('click', handleStake);
    document.getElementById('cancel-stake').addEventListener('click', function() {
        document.getElementById('stake-dialog').style.display = 'none';
    });
    fetchSuggestions();
