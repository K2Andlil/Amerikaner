class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
    }

    toString() {
        const rankNames = {11: 'J', 12: 'Q', 13: 'K', 14: 'A'};
        const rankStr = rankNames[this.rank] || this.rank.toString();
        return `${rankStr} of ${this.suit}`;
    }

    toDict() {
        return {suit: this.suit, rank: this.rank};
    }
}

class Game {
    constructor() {
        this.players = [
            {id: 0, name: 'Spiller 1'},
            {id: 1, name: 'Spiller 2'},
            {id: 2, name: 'Spiller 3'},
            {id: 3, name: 'Spiller 4'}
        ];
        this.currentRound = 1;
        this.phase = 'waiting';
        this.deck = this.createDeck();
        this.hands = {};
        this.bids = {};
        this.currentBidder = 0;
        this.highestBid = 6;
        this.highestBidder = null;
        this.trumpSuit = null;
        this.trumpCardRequest = null;
        this.teams = {};
        this.currentTrick = [];
        this.trickStarter = null;
        this.tricksWon = {};
        this.scores = {};
        this.currentPlayer = 0;
        this.passes = new Set();
        this.leadSuit = null;
        this.selectedPartnerCard = null;
        this.firstCardPlayed = false;
        this.waitingForPartner = false;

        // Initialize scores and tricks
        this.players.forEach(player => {
            this.scores[player.id] = 0;
            this.tricksWon[player.id] = 0;
        });

        this.startGame();
    }

    createDeck() {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const deck = [];
        for (const suit of suits) {
            for (let rank = 2; rank <= 14; rank++) {
                deck.push(new Card(suit, rank));
            }
        }
        // Shuffle deck
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    dealCards() {
        this.hands = {0: [], 1: [], 2: [], 3: []};
        for (let i = 0; i < 13; i++) {
            for (let playerId = 0; playerId < 4; playerId++) {
                this.hands[playerId].push(this.deck.pop());
            }
        }
        // Sort hands
        Object.keys(this.hands).forEach(playerId => {
            this.hands[playerId].sort((a, b) => {
                if (a.suit !== b.suit) {
                    const suitOrder = ['clubs', 'diamonds', 'hearts', 'spades'];
                    return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
                }
                return a.rank - b.rank;
            });
        });
    }

    startGame() {
        this.dealCards();
        this.startBidding();
        this.updateDisplay();
    }

    startBidding() {
        this.phase = 'bidding';
        this.currentBidder = 0;
        this.bids = {};
        this.passes = new Set();
        this.highestBid = 6;
        this.highestBidder = null;
    }

    makeBid(playerId, bid) {
        if (playerId !== this.currentBidder) return false;

        if (bid === 'pass') {
            this.passes.add(playerId);
        } else if (bid > this.highestBid && bid >= 7 && bid <= 13) {
            this.bids[playerId] = bid;
            this.highestBid = bid;
            this.highestBidder = playerId;
        } else {
            return false;
        }

        this.currentBidder = (this.currentBidder + 1) % 4;

        // Check if bidding is complete
        if (this.passes.size >= 3 || (Object.keys(this.bids).length + this.passes.size) >= 4) {
            if (this.highestBidder !== null) {
                this.phase = 'playing';
                this.currentPlayer = this.highestBidder;
                this.trickStarter = this.currentPlayer;
                this.firstCardPlayed = false;
            } else {
                // All passed, redeal
                this.deck = this.createDeck();
                this.dealCards();
                this.startBidding();
            }
        }

        return true;
    }

    selectPartnerCard(cardData) {
        this.selectedPartnerCard = cardData;
        this.trumpCardRequest = cardData;

        // Find partner based on requested card
        let partnerId = null;
        for (const playerId of Object.keys(this.hands)) {
            if (parseInt(playerId) !== this.highestBidder) {
                for (const card of this.hands[playerId]) {
                    if (card.suit === cardData.suit && card.rank === cardData.rank) {
                        partnerId = parseInt(playerId);
                        break;
                    }
                }
                if (partnerId !== null) break;
            }
        }

        // Set up teams
        this.teams = {};
        if (partnerId !== null) {
            this.teams[this.highestBidder] = 'team1';
            this.teams[partnerId] = 'team1';
            for (const player of this.players) {
                if (!(player.id in this.teams)) {
                    this.teams[player.id] = 'solo';
                }
            }
        } else {
            // If no partner found, bidder plays alone against all
            this.teams[this.highestBidder] = 'team1';
            for (const player of this.players) {
                if (player.id !== this.highestBidder) {
                    this.teams[player.id] = 'solo';
                }
            }
        }

        this.phase = 'playing';
        this.waitingForPartner = false;
    }

    playCard(playerId, cardData) {
        if (playerId !== this.currentPlayer) return false;

        // Find and remove card from player's hand
        let cardToPlay = null;
        for (let i = 0; i < this.hands[playerId].length; i++) {
            const card = this.hands[playerId][i];
            if (card.suit === cardData.suit && card.rank === cardData.rank) {
                cardToPlay = this.hands[playerId].splice(i, 1)[0];
                break;
            }
        }

        if (!cardToPlay) return false;

        // If this is the first card played by the bidder, set trump suit
        if (!this.firstCardPlayed && playerId === this.highestBidder) {
            this.trumpSuit = cardToPlay.suit;
            this.firstCardPlayed = true;
            this.leadSuit = cardToPlay.suit;
            
            this.currentTrick.push({
                playerId: playerId,
                card: cardToPlay,
                playerName: this.players[playerId].name
            });

            this.currentPlayer = (this.currentPlayer + 1) % 4;
            
            // Show partner selection
            this.phase = 'partner_selection';
            this.updateDisplay();
            this.showPartnerSelection();
            return true;
        }

        // If we're waiting for partner to play the requested card
        if (this.waitingForPartner && this.trumpCardRequest) {
            if (cardToPlay.suit === this.trumpCardRequest.suit && 
                cardToPlay.rank === this.trumpCardRequest.rank) {
                this.waitingForPartner = false;
                this.phase = 'playing';
            }
        }

        // Validate play (must follow suit if possible)
        if (this.currentTrick.length > 0) {
            if (this.leadSuit && this.hasSuit(playerId, this.leadSuit)) {
                if (cardToPlay.suit !== this.leadSuit) {
                    // Invalid play - put card back
                    this.hands[playerId].push(cardToPlay);
                    return false;
                }
            }
        } else {
            this.leadSuit = cardToPlay.suit;
        }

        this.currentTrick.push({
            playerId: playerId,
            card: cardToPlay,
            playerName: this.players[playerId].name
        });

        this.currentPlayer = (this.currentPlayer + 1) % 4;

        // Check if trick is complete
        if (this.currentTrick.length === 4) {
            this.completeTrick();
        }

        return true;
    }

    hasSuit(playerId, suit) {
        return this.hands[playerId].some(card => card.suit === suit);
    }

    showPartnerSelection() {
        const container = document.getElementById('partner-card-buttons');
        container.innerHTML = '';

        // Create buttons for each rank in the trump suit
        const ranks = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
        const rankNames = {14: 'A', 13: 'K', 12: 'Q', 11: 'J'};

        ranks.forEach(rank => {
            const button = document.createElement('button');
            button.className = 'partner-card-btn';
            button.dataset.rank = rank;
            button.dataset.suit = this.trumpSuit;
            
            const rankDisplay = rankNames[rank] || rank.toString();
            const suitSymbol = this.getSuitSymbol(this.trumpSuit);
            button.textContent = `${rankDisplay}${suitSymbol}`;
            
            button.addEventListener('click', () => {
                // Clear previous selection
                document.querySelectorAll('.partner-card-btn').forEach(b => b.classList.remove('selected'));
                button.classList.add('selected');
                this.selectedPartnerCard = {suit: this.trumpSuit, rank: rank};
                document.getElementById('confirm-partner').classList.remove('hidden');
            });
            
            container.appendChild(button);
        });
    }

    getSuitSymbol(suit) {
        const symbols = {
            hearts: '♥',
            diamonds: '♦',
            clubs: '♣',
            spades: '♠'
        };
        return symbols[suit] || suit;
    }

    completeTrick() {
        // Determine winner
        let winnerPlay = this.currentTrick[0];

        for (let i = 1; i < this.currentTrick.length; i++) {
            const play = this.currentTrick[i];
            const card = play.card;
            const winnerCard = winnerPlay.card;

            // Trump beats everything
            if (card.suit === this.trumpSuit && winnerCard.suit !== this.trumpSuit) {
                winnerPlay = play;
            } else if (card.suit === this.trumpSuit && winnerCard.suit === this.trumpSuit) {
                if (card.rank > winnerCard.rank) {
                    winnerPlay = play;
                }
            } else if (winnerCard.suit !== this.trumpSuit && card.suit === this.leadSuit && winnerCard.suit === this.leadSuit) {
                if (card.rank > winnerCard.rank) {
                    winnerPlay = play;
                }
            } else if (winnerCard.suit !== this.trumpSuit && winnerCard.suit !== this.leadSuit && card.suit === this.leadSuit) {
                winnerPlay = play;
            }
        }

        // Award trick
        this.tricksWon[winnerPlay.playerId]++;

        // Set next starter
        this.currentPlayer = winnerPlay.playerId;
        this.trickStarter = this.currentPlayer;

        // Reset for next trick
        this.currentTrick = [];
        this.leadSuit = null;

        // Check if round is complete
        if (Object.values(this.hands).every(hand => hand.length === 0)) {
            this.completeRound();
        }
    }

    completeRound() {
        // Calculate scores
        let team1Tricks = 0;
        if (this.highestBidder in this.teams) {
            for (const [playerId, team] of Object.entries(this.teams)) {
                if (team === 'team1') {
                    team1Tricks += this.tricksWon[parseInt(playerId)];
                }
            }
        }

        // Award points
        if (team1Tricks >= this.highestBid) {
            // Team1 succeeded
            for (const [playerId, team] of Object.entries(this.teams)) {
                if (team === 'team1') {
                    this.scores[parseInt(playerId)] += this.highestBid;
                }
            }
        } else {
            // Team1 failed, solo players get points
            for (const [playerId, team] of Object.entries(this.teams)) {
                if (team === 'solo') {
                    this.scores[parseInt(playerId)] += this.tricksWon[parseInt(playerId)];
                }
            }
        }

        // Solo players always get points for tricks taken
        for (const [playerId, team] of Object.entries(this.teams)) {
            if (team === 'solo') {
                this.scores[parseInt(playerId)] += this.tricksWon[parseInt(playerId)];
            }
        }

        this.phase = 'round_end';
    }

    startNextRound() {
        this.currentRound++;
        // Reset for next round
        this.deck = this.createDeck();
        this.tricksWon = {};
        this.players.forEach(player => {
            this.tricksWon[player.id] = 0;
        });
        this.teams = {};
        this.currentTrick = [];
        this.trumpSuit = null;
        this.trumpCardRequest = null;
        this.selectedPartnerCard = null;
        this.firstCardPlayed = false;
        this.waitingForPartner = false;
        
        this.startGame();
    }

    updateDisplay() {
        this.updatePhaseIndicator();
        this.updateGameInfo();
        this.updatePlayerHands();
        this.updateControls();
        this.updateTrickArea();
        this.updatePlayerStats();
    }

    updatePhaseIndicator() {
        const indicator = document.getElementById('phase-indicator');
        const phaseNames = {
            'bidding': 'Budgivning',
            'partner_selection': 'Velg partner',
            'playing': 'Spilling',
            'round_end': 'Runde ferdig'
        };
        indicator.textContent = phaseNames[this.phase] || this.phase;
    }

    updateGameInfo() {
        document.getElementById('trump-display').textContent = this.trumpSuit ? 
            this.getSuitName(this.trumpSuit) : '-';
        document.getElementById('highest-bid').textContent = this.highestBidder !== null ? 
            this.highestBid : '-';
        document.getElementById('current-round').textContent = this.currentRound;
        
        const totalCards = Object.values(this.hands).reduce((sum, hand) => sum + hand.length, 0);
        document.getElementById('cards-left').textContent = totalCards;
    }

    updatePlayerHands() {
        for (let playerId = 0; playerId < 4; playerId++) {
            const handContainer = document.querySelector(`[data-player="${playerId}"]`);
            handContainer.innerHTML = '';
            
            if (this.hands[playerId]) {
                this.hands[playerId].forEach(card => {
                    const cardElement = this.createCardElement(card, playerId);
                    handContainer.appendChild(cardElement);
                });
            }
            
            // Highlight current player
            const playerSection = document.getElementById(`player-${playerId}`);
            if ((this.phase === 'playing' || this.phase === 'partner_selection') && this.currentPlayer === playerId) {
                playerSection.classList.add('current-player');
            } else {
                playerSection.classList.remove('current-player');
            }
        }
    }

    updateControls() {
        // Hide all controls
        document.getElementById('bidding-controls').classList.add('hidden');
        document.getElementById('partner-controls').classList.add('hidden');
        document.getElementById('playing-controls').classList.add('hidden');
        document.getElementById('round-end-controls').classList.add('hidden');

        if (this.phase === 'bidding') {
            document.getElementById('bidding-controls').classList.remove('hidden');
            document.getElementById('current-bidder').textContent = this.players[this.currentBidder].name;
            this.updateBidButtons();
        } else if (this.phase === 'partner_selection') {
            document.getElementById('partner-controls').classList.remove('hidden');
            document.getElementById('partner-winner').textContent = this.players[this.highestBidder].name;
            document.getElementById('trump-suit-display').textContent = this.getSuitName(this.trumpSuit);
        } else if (this.phase === 'playing') {
            document.getElementById('playing-controls').classList.remove('hidden');
            document.getElementById('current-player-name').textContent = this.players[this.currentPlayer].name;
        } else if (this.phase === 'round_end') {
            document.getElementById('round-end-controls').classList.remove('hidden');
            this.updateRoundResults();
        }
    }

    updateBidButtons() {
        const bidButtons = document.querySelectorAll('.bid-btn');
        bidButtons.forEach(btn => {
            const bidValue = parseInt(btn.dataset.bid);
            btn.disabled = bidValue <= this.highestBid;
        });
    }

    updateTrickArea() {
        const playedCardsContainer = document.getElementById('played-cards');
        playedCardsContainer.innerHTML = '';

        this.currentTrick.forEach(play => {
            const playedCardDiv = document.createElement('div');
            playedCardDiv.className = 'played-card';

            const cardElement = this.createCardElement(play.card, null, false);
            const playerNameDiv = document.createElement('div');
            playerNameDiv.textContent = play.playerName;

            playedCardDiv.appendChild(playerNameDiv);
            playedCardDiv.appendChild(cardElement);
            playedCardsContainer.appendChild(playedCardDiv);
        });
    }

    updatePlayerStats() {
        for (let playerId = 0; playerId < 4; playerId++) {
            const playerSection = document.getElementById(`player-${playerId}`);
            const tricksSpan = playerSection.querySelector('.tricks');
            const scoreSpan = playerSection.querySelector('.score');
            
            tricksSpan.textContent = this.tricksWon[playerId] || 0;
            scoreSpan.textContent = this.scores[playerId] || 0;
        }
    }

    updateRoundResults() {
        const resultsElement = document.getElementById('round-results');
        let resultText = '';
        
        if (this.highestBidder !== null) {
            const team1Tricks = Object.entries(this.teams)
                .filter(([_, team]) => team === 'team1')
                .reduce((sum, [playerId, _]) => sum + (this.tricksWon[parseInt(playerId)] || 0), 0);
            
            const success = team1Tricks >= this.highestBid;
            resultText = `${this.players[this.highestBidder].name} budde ${this.highestBid} og tok ${team1Tricks} stikk. `;
            resultText += success ? 'Maktet!' : 'Feilet!';
        }
        
        resultsElement.textContent = resultText;
    }

    createCardElement(card, playerId, clickable = true) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${card.suit}`;

        if (clickable && (this.phase === 'playing' || this.phase === 'partner_selection') && playerId === this.currentPlayer) {
            cardDiv.classList.add('playable');
            cardDiv.addEventListener('click', () => {
                this.playCard(playerId, card.toDict());
                this.updateDisplay();
            });
        }

        const rankSymbols = {11: 'J', 12: 'Q', 13: 'K', 14: 'A'};
        const suitSymbols = {
            hearts: '♥',
            diamonds: '♦',
            clubs: '♣',
            spades: '♠'
        };

        const rankDisplay = rankSymbols[card.rank] || card.rank.toString();
        const suitDisplay = suitSymbols[card.suit] || card.suit;

        cardDiv.innerHTML = `
            <div class="card-rank">${rankDisplay}</div>
            <div class="card-suit">${suitDisplay}</div>
        `;

        return cardDiv;
    }

    getSuitName(suit) {
        const suitNames = {
            hearts: '♥️ Hjerter',
            diamonds: '♦️ Ruter',
            clubs: '♣️ Kløver',
            spades: '♠️ Spar'
        };
        return suitNames[suit] || suit;
    }
}

// Initialize game
let game = new Game();

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Bidding buttons
    document.querySelectorAll('.bid-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const bid = parseInt(this.dataset.bid);
            if (game.makeBid(game.currentBidder, bid)) {
                game.updateDisplay();
            }
        });
    });

    document.querySelector('.pass-btn').addEventListener('click', function() {
        if (game.makeBid(game.currentBidder, 'pass')) {
            game.updateDisplay();
        }
    });

    // Partner selection confirmation
    document.getElementById('confirm-partner').addEventListener('click', function() {
        if (game.selectedPartnerCard) {
            game.selectPartnerCard(game.selectedPartnerCard);
            game.updateDisplay();
        }
    });

    // Round end controls
    document.getElementById('next-round').addEventListener('click', function() {
        game.startNextRound();
    });

    document.getElementById('new-game').addEventListener('click', function() {
        game = new Game();
    });
});