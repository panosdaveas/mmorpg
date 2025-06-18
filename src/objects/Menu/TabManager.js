// TabManager.js - Clean, simplified version with active parameter
import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { TiledUIMenu } from "./TiledUIMenu.js";
import { events } from "../../Events.js";

// Static imports for all menu data
import baseMenuData from "../../levels/json/menu.json";
import tabProfileData from "../../levels/json/tabProfile.json";
import tabPlayersData from "../../levels/json/tabPlayers.json";

export class TabManager extends GameObject {
    constructor({ canvas }) {
        super({
            position: new Vector2(0, 0)
        });

        this.canvas = canvas;
        this.currentActiveTab = null;
        this.isVisible = false;
        this.drawLayer = "HUD";

        // Store menu instances
        this.baseMenu = null;
        this.tabMenus = new Map();

        // Define available tab data
        this.tabDataMap = new Map([
            ['profile', tabProfileData],
            ['players', tabPlayersData],
        ]);

        console.log("TabManager: Available tabs:", Array.from(this.tabDataMap.keys()));

        this.initializeMenus();
        this.setupEventListeners();
    }

    async initializeMenus() {
        console.log("TabManager: Initializing menus...");

        try {
            // Create base menu (starts active - keyboard enabled)
            this.baseMenu = new TiledUIMenu({
                canvas: this.canvas,
                menuData: baseMenuData,
                active: true
            });

            // Set action handlers for base menu navigation
            this.baseMenu.setActionHandlers({
                'openTabProfile': () => this.showTab('profile'),
                'openTabPlayers': () => this.showTab('players'),
                'openProfile': () => this.showTab('profile'),
                'openPlayers': () => this.showTab('players'),
                'closeMenu': () => this.hide(),
                'setId': () => this.baseMenu.setID(),
            });

            // Wait for base menu to be ready
            await this.waitForMenuReady(this.baseMenu);

            console.log("TabManager: Base menu initialized successfully");

        } catch (error) {
            console.error("TabManager: Failed to initialize base menu:", error);
        }
    }

    async showTab(tabName) {
        console.log(`TabManager: Switching to tab '${tabName}'`);

        // Hide current tab first
        this.hideCurrentTab();

        // Load tab menu if not already loaded
        const tabMenu = await this.loadTabMenu(tabName);

        if (tabMenu) {
            // Disable keyboard input on base menu
            if (this.baseMenu) {
                this.baseMenu.setActive(false);
            }

            // Show and activate the tab
            tabMenu.show();
            this.currentActiveTab = tabName;
            events.emit("TAB_CHANGED", { tab: tabName });
            console.log(`TabManager: Tab '${tabName}' active, base menu keyboard disabled`);
        } else {
            console.error(`TabManager: Failed to show tab '${tabName}'`);
        }
    }

    hideCurrentTab() {
        if (this.currentActiveTab) {
            const currentMenu = this.tabMenus.get(this.currentActiveTab);
            if (currentMenu) {
                currentMenu.hide();
            }

            // Re-enable keyboard input on base menu
            if (this.baseMenu) {
                this.baseMenu.setActive(true);
            }

            const previousTab = this.currentActiveTab;
            this.currentActiveTab = null;
            events.emit("TAB_CHANGED", { tab: null, previous: previousTab });
            console.log(`TabManager: Tab closed, base menu keyboard re-enabled`);
        }
    }

    async loadTabMenu(tabName) {
        console.log(`TabManager: loadTabMenu called for '${tabName}'`);

        // Return existing menu if already loaded
        if (this.tabMenus.has(tabName)) {
            return this.tabMenus.get(tabName);
        }

        // Get tab data from our imported data
        const tabData = this.tabDataMap.get(tabName);

        if (!tabData) {
            console.warn(`TabManager: No data found for tab '${tabName}'`);
            return null;
        }

        console.log(`TabManager: Creating new menu for tab '${tabName}'`);

        try {
            // Create tab menu instance (always active)
            const tabMenu = new TiledUIMenu({
                canvas: this.canvas,
                menuData: tabData,
                active: true
            });

            // Set tab-specific action handlers
            this.setTabActionHandlers(tabMenu, tabName);

            // Wait for tab menu to be ready
            await this.waitForMenuReady(tabMenu);

            // Store the menu
            this.tabMenus.set(tabName, tabMenu);

            // Initially hide the tab menu
            tabMenu.hide();

            console.log(`TabManager: Tab menu '${tabName}' loaded successfully`);
            if (tabName === 'players') {
                // console.log(this.parent?.multiplayerManager.getRemotePlayers());
                const players = this.parent?.multiplayerManager.players;
                for (const [id, player] of Object.entries(players)) {
                    console.log(id, player.getAttribute("currentLevel"),);
                  }
                let sliced = Object.fromEntries(Object.entries(players).slice(0, 1));
                const playerId = this.parent?.multiplayerManager?.mySocketId;
                tabMenu.setID(playerId);
            }
            return tabMenu;

        } catch (error) {
            console.error(`TabManager: Error creating tab menu '${tabName}':`, error);
            return null;
        }
    }

    setTabActionHandlers(tabMenu, tabName) {
        const commonHandlers = {
            'closeTab': () => this.hideCurrentTab(),
            'backToMain': () => this.hideCurrentTab(),
        };

        const tabSpecificHandlers = {
            'profile': {
                'updateProfile': () => this.handleProfileUpdate(),
                'saveProfile': () => this.handleProfileSave(),
            },
            'players': {
                'invitePlayer': () => this.handlePlayerInvite(),
                'kickPlayer': () => this.handlePlayerKick(),
                'refreshPlayers': () => this.handlePlayersRefresh(),
            }
        };

        const handlers = {
            ...commonHandlers,
            ...(tabSpecificHandlers[tabName] || {})
        };

        tabMenu.setActionHandlers(handlers);
    }

    show() {
        console.log("TabManager: Showing menu");
        this.isVisible = true;
        if (this.baseMenu) {
            this.baseMenu.show();
        }
        events.emit("MENU_OPEN");
    }

    hide() {
        console.log("TabManager: Hiding menu");
        this.isVisible = false;

        if (this.baseMenu) {
            this.baseMenu.hide();
        }

        this.hideCurrentTab();
        events.emit("MENU_CLOSE");
    }

    step(delta, root) {
        if (!this.isVisible) {
            // Handle menu opening
            if (root.input?.getActionJustPressed("Enter")) {
                this.show();
            }
            return;
        }

        // Handle menu closing and navigation
        if (root.input?.getActionJustPressed("Escape")) {
            if (this.currentActiveTab) {
                // Close current tab first
                this.hideCurrentTab();
            } else {
                // Close entire menu
                this.hide();
            }
            return;
        }

        // Step base menu (active state automatically controls keyboard input)
        if (this.baseMenu) {
            this.baseMenu.step(delta, root);
        }

        // Step current tab menu if active
        if (this.currentActiveTab) {
            const currentMenu = this.tabMenus.get(this.currentActiveTab);
            if (currentMenu && currentMenu.isVisible) {
                currentMenu.step(delta, root);
            }
        }
    }

    draw(ctx) {
        if (!this.isVisible) return;

        ctx.save();

        // Always draw base menu first (background and navigation)
        if (this.baseMenu) {
            this.baseMenu.draw(ctx);
        }

        // Draw current tab menu on top
        if (this.currentActiveTab) {
            const currentMenu = this.tabMenus.get(this.currentActiveTab);
            if (currentMenu && currentMenu.isVisible) {
                currentMenu.draw(ctx);
            }
        }

        ctx.restore();
    }

    setupEventListeners() {
        // Listen for external events
        events.on(this, "PLAYER_DATA_UPDATED", this.handlePlayerDataUpdate.bind(this));
        events.on(this, "MULTIPLAYER_UPDATE", this.handleMultiplayerUpdate.bind(this));
    }

    // Tab-specific action handlers
    handleProfileUpdate() {
        console.log("TabManager: Handling profile update");
        events.emit("PROFILE_UPDATE_REQUESTED");
    }

    handleProfileSave() {
        console.log("TabManager: Handling profile save");
        events.emit("PROFILE_SAVE_REQUESTED");
    }

    handlePlayerInvite() {
        console.log("TabManager: Handling player invite");
        events.emit("PLAYER_INVITE_REQUESTED");
    }

    handlePlayerKick() {
        console.log("TabManager: Handling player kick");
        events.emit("PLAYER_KICK_REQUESTED");
    }

    handlePlayersRefresh() {
        console.log("TabManager: Refreshing players list");
        events.emit("PLAYERS_REFRESH_REQUESTED");
    }

    // Event handlers
    handlePlayerDataUpdate(data) {
        console.log("TabManager: Player data updated");
    }

    handleMultiplayerUpdate(data) {
        console.log("TabManager: Multiplayer data updated");
    }

    // Utility methods
    getCurrentTab() {
        return this.currentActiveTab;
    }

    isTabActive(tabName) {
        return this.currentActiveTab === tabName;
    }

    getAvailableTabs() {
        return Array.from(this.tabDataMap.keys());
    }

    isTabLoaded(tabName) {
        return this.tabMenus.has(tabName);
    }

    async waitForMenuReady(menu, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkReady = () => {
                if (menu.isReady && menu.isReady()) {
                    resolve(menu);
                } else if (Date.now() - startTime > timeout) {
                    console.warn("Menu initialization timeout, continuing anyway");
                    resolve(menu);
                } else {
                    setTimeout(checkReady, 100);
                }
            };

            checkReady();
        });
    }

    // Debug methods
    getDebugInfo() {
        return {
            isVisible: this.isVisible,
            currentActiveTab: this.currentActiveTab,
            loadedTabs: Array.from(this.tabMenus.keys()),
            availableTabs: Array.from(this.tabDataMap.keys()),
            baseMenuLoaded: !!this.baseMenu,
            baseMenuActive: this.baseMenu ? this.baseMenu.active : false,
            baseMenuVisible: this.baseMenu ? this.baseMenu.isVisible : false,
        };
    }

    testActionHandler(actionName) {
        console.log(`TabManager: Testing action handler '${actionName}'`);
        if (this.baseMenu && this.baseMenu.actionHandlers[actionName]) {
            this.baseMenu.actionHandlers[actionName]();
        } else {
            console.log(`TabManager: No handler found for '${actionName}'`);
        }
    }
}