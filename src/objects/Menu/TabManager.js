// TabManager.js - Enhanced version with separate main and interactive menus
import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { TiledUIMenu } from "./TiledUIMenu.js";
import { events } from "../../Events.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH, TILE_SIZE } from "../../constants/worldConstants.js";

// Static imports for all menu data
import baseMenuData from "../../levels/json/menu.json";
import tabProfileData from "../../levels/json/tabProfile.json";
import tabPlayersData from "../../levels/json/tabPlayers.json";
import tabMessagesData from "../../levels/json/tabMessages.json";
import tabInteractiveMenu from "../../levels/json/interactiveMenu.json";

export class TabManager extends GameObject {
    constructor({ canvas }) {
        super({
            position: new Vector2(0, 0)
        });

        this.canvas = canvas;
        this.currentActiveTab = null;
        this.isVisible = false;
        this.drawLayer = "UI";

        // Store menu instances - SEPARATE MENUS
        this.baseMenu = null;           // Main menu (with tabs)
        this.interactiveMenu = null;    // Interactive menu for remote players
        this.tabMenus = new Map();

        // Track which menu type is currently active
        this.currentMenuType = null; // 'main' or 'interactive'

        // Define available tab data
        this.tabDataMap = new Map([
            ['profile', tabProfileData],
            ['players', tabPlayersData],
            ['messages', tabMessagesData],
            ['interactiveMenu', tabInteractiveMenu],
        ]);

        console.log("TabManager: Available tabs:", Array.from(this.tabDataMap.keys()));

        this.initializeMenus();
        this.setupEventListeners();

        this.currentPage = 0;
        this.pageSize = 8;
        this.idList = null;
        this.currentMessage = 0;
        this.isReady = false;
        this.scale = 1;
    }

    async initializeMenus() {
        console.log("TabManager: Initializing main menu...");

        try {
            const menuScale = this.calculateMenuScale();
            this.scale = menuScale;

            // Create base menu (main menu with tabs)
            this.baseMenu = new TiledUIMenu({
                canvas: this.canvas,
                menuData: baseMenuData,
                active: true,
                position: new Vector2(0, 0),
                scale: menuScale,
                zIndex: 2,
            });

            // Set action handlers for base menu navigation
            this.baseMenu.setActionHandlers({
                'openTabProfile': () => this.showTab('profile'),
                'openTabPlayers': () => this.showTab('players'),
                'openProfile': () => this.showTab('profile'),
                'openPlayers': () => this.showTab('players'),
                'openMessages': () => this.showTab('messages'),
                'closeMenu': () => this.hide(),
                'setId': () => this.baseMenu.setID(),
                'setText': () => this.baseMenu.setText(),
                'refreshPlayers': () => this.handlePlayersRefresh(),
            });

            // Wait for base menu to be ready
            await this.waitForMenuReady(this.baseMenu);

            console.log("TabManager: Main menu initialized successfully");

        } catch (error) {
            console.error("TabManager: Failed to initialize main menu:", error);
        }
    }

    worldToScreenPosition(worldPosition) {
        // Get camera and zoom from the main scene
        const mainScene = this.parent; // Assuming TabManager is added to main scene
        const camera = mainScene?.camera;
        const zoom = mainScene?.level?.scale ?? 1;

        // Default screen position if no camera
        let screenX = worldPosition.x;
        let screenY = worldPosition.y;

        if (camera) {
            // Apply camera transformation: screen = (world + camera) * zoom
            screenX = (worldPosition.x + camera.position.x) * zoom;
            screenY = (worldPosition.y + camera.position.y) * zoom;
        } else {
            // If no camera, just apply zoom
            screenX = worldPosition.x * zoom;
            screenY = worldPosition.y * zoom;
        }

        // Optional: Offset the menu slightly above the hero
        screenY -= 50; // Move menu 50 pixels above the hero

        // Ensure the menu stays within screen bounds
        const menuWidth = tabInteractiveMenu.width * TILE_SIZE; // Estimate menu width
        const menuHeight = tabInteractiveMenu.height * TILE_SIZE; // Estimate menu height

        // Keep menu within canvas bounds
        screenX = Math.max(0, Math.min(screenX, this.canvas.width - menuWidth));
        screenY = Math.max(0, Math.min(screenY, this.canvas.height - menuHeight));

        console.log(`TabManager: Converted world pos (${worldPosition.x}, ${worldPosition.y}) to screen pos (${screenX}, ${screenY})`);

        return new Vector2(screenX, screenY);
    }

    ready() {
        // Handle interactive menu for remote player interactions
        events.on("INTERACTIVE_MENU", this, async (data) => {
            console.log("TabManager: Creating interactive menu for remote player");

            // Hide any currently visible menu
            this.hide();
            const adjustedPosition = new Vector2(data.position.x + 8, data.position.y - 58)
            const screenPosition = this.worldToScreenPosition(adjustedPosition);

            // Create interactive menu separately (don't overwrite baseMenu)
            this.interactiveMenu = new TiledUIMenu({
                canvas: this.canvas,
                menuData: tabInteractiveMenu,
                active: true,
                position: screenPosition,
                scale: 1,
                zIndex: 2,
                autoHandleEscape: true,
            });

            // console.log(this.interactiveMenu); // this prints the object correctly
            // console.log(this.interactiveMenu.buttonComponents); // this returns empty map

            while (!this.interactiveMenu.isReady()) {
                await new Promise(resolve => setTimeout(resolve, 10)); // Wait 10ms
            }

            const tradeButtonId = this.interactiveMenu.findObjectByName("tradeRequest");
            const targetPlayerAddress = data.targetPlayer.getAttribute("address");
            const targetPlayerChainId = data.targetPlayer.getAttribute("chainId");
            const targetPlayerId = data.targetPlayer.getAttribute("id");


            if (!targetPlayerAddress) {
                this.interactiveMenu.setButtonEnabled(tradeButtonId, false);
            }

            this.interactiveMenu.setActionHandlers({
                'sendChatMessage': () => this.handleChatAction(targetPlayerId),
                'tradeRequest': () => this.openTradeSubmenu(),
                'closeMenu': () => this.hideInteractiveMenu(),
            });

            // Show interactive menu
            this.showInteractiveMenu();
        });

        this.isReady = true;
    }

    openTradeSubmenu() {
        this.tradeSubmenu = new TiledUIMenu({
            canvas: this.canvas,
            menuData: tabInteractiveMenu,
            active: true,
            // position: new Vector2(data.position.x, data.position.y),
            position: new Vector2(0, 0),
            scale: 1,
            zIndex: 3,
            autoHandleEscape: true,
        });

        // this.interactiveMenu.addChildMenu(tradeSubmenu);
        const activeMenu = this.interactiveMenu.getActiveMenu();
        activeMenu.addChildMenu(this.tradeSubmenu);
    }

    step(delta, root) {
        if (!this.isVisible) {
            // Handle menu opening with Enter key
            if (root.input?.getActionJustPressed("Enter")) {
                // Only show main menu if no interactive menu is active
                if (!this.interactiveMenu?.isVisible) {
                    this.showMainMenu();
                }
            }
            return;
        }

        // Check if interactive menu closed itself (important for cleanup)
        if (this.currentMenuType === 'interactive' && this.interactiveMenu && !this.interactiveMenu.isVisible) {
            console.log("TabManager: Detected interactive menu closed itself, cleaning up");
            this.hideInteractiveMenu();
            return;
        }

        // Handle Escape key at TabManager level for proper tab navigation
        if (root.input?.getActionJustPressed("Escape")) {
            if (this.currentMenuType === 'interactive') {
                // Let interactive menu handle its own hierarchical closing
                // (This will be handled by the menu's step method)
            } else if (this.currentMenuType === 'main') {
                if (this.currentActiveTab) {
                    // Close current tab first, return to base menu
                    this.hideCurrentTab();
                    return; // Don't let other menus process this Escape
                } else {
                    // Close entire main menu
                    this.hideMainMenu();
                    return;
                }
            }
        }

        // Step the appropriate menu based on current type
        if (this.currentMenuType === 'interactive' && this.interactiveMenu) {
            this.interactiveMenu.step(delta, root);
        } else if (this.currentMenuType === 'main') {
            // Step base menu (but it won't handle Escape since we handled it above)
            if (this.baseMenu) {
                this.baseMenu.step(delta, root);
            }

            // Step current tab menu if active (but it won't handle Escape)
            if (this.currentActiveTab) {
                const currentMenu = this.tabMenus.get(this.currentActiveTab);
                if (currentMenu && currentMenu.isVisible) {
                    currentMenu.step(delta, root);
                }
            }
        }
    }
    




    draw(ctx) {
        if (!this.isVisible) return;

        ctx.save();
        // Fill canvas with shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        if (this.currentMenuType === 'interactive' && this.interactiveMenu) {
            // Draw interactive menu (will automatically draw its children)
            this.interactiveMenu.draw(ctx);
        } else if (this.currentMenuType === 'main') {
            // Draw main menu system
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
        }

        ctx.restore();
    }

    // Main menu methods
    showMainMenu() {
        console.log("TabManager: Showing main menu");
        this.currentMenuType = 'main';
        this.isVisible = true;

        if (this.baseMenu) {
            this.baseMenu.show();
        }

        events.emit("MENU_OPEN");
    }

    hideMainMenu() {
        console.log("TabManager: Hiding main menu");

        if (this.baseMenu) {
            this.baseMenu.hide();
        }

        this.hideCurrentTab();

        if (this.currentMenuType === 'main') {
            this.isVisible = false;
            this.currentMenuType = null;
            events.emit("MENU_CLOSE");
        }
    }


    // Interactive menu methods
    showInteractiveMenu() {
        console.log("TabManager: Showing interactive menu");
        this.currentMenuType = 'interactive';
        this.isVisible = true;

        if (this.interactiveMenu) {
            this.interactiveMenu.show();
        }

        events.emit("MENU_OPEN");
    }


    hideInteractiveMenu() {
        console.log("TabManager: Hiding interactive menu");

        if (this.interactiveMenu) {
            this.interactiveMenu.hide(); // This will also hide all child menus
            this.interactiveMenu = null;
        }

        if (this.currentMenuType === 'interactive') {
            this.isVisible = false;
            this.currentMenuType = null;
            events.emit("MENU_CLOSE");
        }
    }

    // Generic show/hide methods for backwards compatibility
    show() {
        // Default to showing main menu
        this.showMainMenu();
    }

    hide() {
        // Hide whatever menu is currently active
        if (this.currentMenuType === 'interactive') {
            this.hideInteractiveMenu();
        } else if (this.currentMenuType === 'main') {
            this.hideMainMenu();
        }
    }

    // Helper method to check if interactive menu is active
    isTabActive(tabName) {
        if (tabName === 'interactiveMenu') {
            return this.currentMenuType === 'interactive';
        }
        return this.currentActiveTab === tabName;
    }

    calculateMenuScale() {
        if (!this.canvas || !baseMenuData) return 1;

        // Get the original menu dimensions from the map data
        const originalWidth = baseMenuData.width * TILE_SIZE;
        const originalHeight = baseMenuData.height * TILE_SIZE;

        // Calculate scale to fit canvas height
        const scaleToFitHeight = this.canvas.height / originalHeight;

        // Optionally, also consider width to maintain aspect ratio
        const scaleToFitWidth = this.canvas.width / originalWidth;

        // Use the smaller scale to ensure it fits both dimensions
        return Math.min(scaleToFitHeight, scaleToFitWidth);
    }

    async showTab(tabName) {
        console.log(`TabManager: Switching to tab '${tabName}'`);
        this.hideCurrentTab();
        const tabMenu = await this.loadTabMenu(tabName);
        if (tabMenu) {
            if (this.baseMenu) {
                this.baseMenu.setActive(false);
            }
            tabMenu.show();
            tabMenu.setActive(true);
            this.currentActiveTab = tabName;
            events.emit("TAB_CHANGED", { tab: tabName, previous: null });
            this.handleTabSpecificSetup(tabName, tabMenu);
        }
    }

    hideCurrentTab() {
        if (this.currentActiveTab) {
            const currentMenu = this.tabMenus.get(this.currentActiveTab);
            if (currentMenu) {
                currentMenu.hide();
            }
            if (this.baseMenu) {
                this.baseMenu.setActive(true);
            }
            const previousTab = this.currentActiveTab;
            this.currentActiveTab = null;
            events.emit("TAB_CHANGED", { tab: null, previous: previousTab });
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
            const menuScale = this.calculateMenuScale();
            // Create tab menu instance (always active)
            const tabMenu = new TiledUIMenu({
                canvas: this.canvas,
                menuData: tabData,
                active: true,
                scale: menuScale,
                zIndex: 1,
                autoHandleEscape: false,
            });

            // Set tab-specific action handlers
            this.setTabActionHandlers(tabMenu, tabName);

            // Wait for tab menu to be ready
            await this.waitForMenuReady(tabMenu);

            // Store the menu
            this.tabMenus.set(tabName, tabMenu);

            console.log(`TabManager: Tab menu '${tabName}' created and ready`);
            return tabMenu;

        } catch (error) {
            console.error(`TabManager: Failed to create tab menu '${tabName}':`, error);
            return null;
        }
    }

    setTabActionHandlers(tabMenu, tabName) {
        const commonHandlers = {
            'closeMenu': () => this.hide(),
            'closeTab': () => this.hideCurrentTab(),
        };

        const tabSpecificHandlers = {
            'profile': {
                'profileUpdate': () => this.handleProfileUpdate(),
                'profileSave': () => this.handleProfileSave(),
            },
            'players': {
                'playerInvite': () => this.handlePlayerInvite(),
                'playerKick': () => this.handlePlayerKick(),
                'refreshPlayers': () => this.handlePlayersRefresh(),
                'paginateForward': () => this.paginateForward(),
                'paginateBackward': () => this.paginateBackward(),
            },
            'messages': {
                'nextItem': () => this.nextMessage(),
                'previousItem': () => this.previousMessage(),
            }
        };

        const handlers = {
            ...commonHandlers,
            ...(tabSpecificHandlers[tabName] || {})
        };

        tabMenu.setActionHandlers(handlers);
    }

    async waitForMenuReady(menu, timeout = 5000) {
        const start = Date.now();
        while (!menu.isReady() && (Date.now() - start) < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!menu.isReady()) {
            throw new Error("Menu failed to initialize within timeout");
        }
    }

    handleTabSpecificSetup(tabName, tabMenu) {
        // Handle tab-specific setup logic here
        if (tabName === 'players') {
            this.updatePlayersTab(tabMenu);
        } else if (tabName === 'messages') {
            this.updateMessagesTab(tabMenu);
        }
    }

    updatePlayersTab(tabMenu) {
        // Update players tab logic
        console.log("TabManager: Updating players tab");
        // const players = this.parent?.multiplayerManager.players;
        this.handlePlayersRefresh();
        // this.idList = Object.keys(players);
        const playerId = this.parent?.multiplayerManager?.mySocketId;
        tabMenu.setText("PlayerId", playerId);
        // tabMenu.setID(playerId);
        this.renderPage();
        if (this.idList.length <= this.pageSize) {
            const paginateForwardButton = tabMenu.findObjectByName('Button_Paginate_Forward')
            const paginateBackwardButton = tabMenu.findObjectByName('Button_Paginate_Backward')
            tabMenu.setButtonEnabled(paginateForwardButton, false);
            tabMenu.setButtonEnabled(paginateBackwardButton, false);
        }
    }

    updateMessagesTab(tabMenu) {
        // Update messages tab logic
        console.log("TabManager: Updating messages tab");
        // Initialize messages display
        const messages = this.parent?.level?.localPlayer?.messages;
        if (!messages || messages.length === 0) {
            this.currentMessage = 0;
        } else {
            // Ensure currentMessage is within bounds
            if (this.currentMessage >= messages.length) {
                this.currentMessage = messages.length - 1;
            }
        }
        this.updateMessageDisplay();
        const nextMessageButton = tabMenu.findObjectByName('Button_Item_Next');
        const previousMessageButton = tabMenu.findObjectByName('Button_Item_Previous');
        if (messages.length < 2) {
            tabMenu.setButtonEnabled(nextMessageButton, false);
            tabMenu.setButtonEnabled(previousMessageButton, false);
        } else {
            tabMenu.setButtonEnabled(nextMessageButton, true);
            tabMenu.setButtonEnabled(previousMessageButton, true);
        }
    }

    setupEventListeners() {
        // Listen for external events
        events.on(this, "PLAYER_DATA_UPDATED", this.handlePlayerDataUpdate.bind(this));
        events.on(this, "MULTIPLAYER_UPDATE", this.handleMultiplayerUpdate.bind(this));
    }

    getPage(array, page, size) {
        const start = page * size;
        const end = start + size;
        return array.slice(start, end);
    }

    renderPage() {
        const ids = this.getPage(this.idList, this.currentPage, this.pageSize);
        const displayString = ids.join(' ');
        const currentMenu = this.tabMenus.get(this.currentActiveTab || 'players');
        currentMenu.setText('RemotePlayers', displayString);
    }

    // Action handlers
    handleChatAction(targetPlayerId) {
        const multiplayerManager = this.parent?.multiplayerManager;
        if (multiplayerManager) {
            multiplayerManager.sendChatMessage(targetPlayerId,
                'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industrys standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged.'
            );
        }
    }

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
        if (this.parent?.multiplayerManager.isSocketConnected()) {
            const players = this.parent?.multiplayerManager.players;
            this.idList = Object.keys(players);
            return;
        }
        this.idList = [];
        events.emit("PLAYERS_REFRESH_REQUESTED");
        return;
    }

    paginateForward() {
        const maxPages = Math.ceil(this.idList.length / this.pageSize);
        if (this.currentPage < maxPages - 1) {
            this.currentPage++;
            this.renderPage();
        }
    }

    paginateBackward() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.renderPage();
        }
    }

    nextMessage(data) {
        const messages = this.parent?.level?.localPlayer?.messages;

        if (!messages || messages.length === 0) {
            console.log("TabManager: No messages available");
            return;
        }

        // Move to next message (with wraparound)
        this.currentMessage = (this.currentMessage + 1) % messages.length;

        console.log(`TabManager: Moving to next message (${this.currentMessage + 1}/${messages.length})`);

        // Update the display
        this.updateMessageDisplay();
    }

    previousMessage(data) {
        const messages = this.parent?.level?.localPlayer?.messages;

        if (!messages || messages.length === 0) {
            console.log("TabManager: No messages available");
            return;
        }

        // Move to previous message (with wraparound)
        this.currentMessage = this.currentMessage === 0
            ? messages.length - 1
            : this.currentMessage - 1;

        console.log(`TabManager: Moving to previous message (${this.currentMessage + 1}/${messages.length})`);

        // Update the display
        this.updateMessageDisplay();
    }

    updateMessageDisplay() {
        if (this.currentActiveTab !== 'messages') {
            return; // Only update if messages tab is active
        }

        const tabMenu = this.tabMenus.get('messages');
        if (!tabMenu) {
            console.warn("TabManager: Messages tab menu not found");
            return;
        }

        const messages = this.parent?.level?.localPlayer?.messages;
        if (!messages || messages.length === 0) {
            // Handle empty messages case
            tabMenu.setText("MessageCount", "0");
            tabMenu.setText("Timestamp", "");
            tabMenu.setText("FromPlayerId", "");
            tabMenu.setText("Message", "No messages");
            return;
        }

        // Ensure currentMessage index is valid
        if (this.currentMessage >= messages.length) {
            this.currentMessage = 0;
        }

        const currentMessage = messages[this.currentMessage];
        const messageCount = messages.length;

        const timestamp = currentMessage.timestamp;
        const date = new Date(timestamp);
        const localString = date.toLocaleString();

        // Update all the text fields
        tabMenu.setText("MessageCount", `${this.currentMessage + 1}/${messageCount}`);
        tabMenu.setText("Timestamp", localString || "");
        tabMenu.setText("FromPlayerId", currentMessage.from?.toString() || "");
        tabMenu.setText("Message", currentMessage.message || "");
    }

    handlePlayerDataUpdate(data) {
        console.log("TabManager: Player data updated", data);
    }

    handleMultiplayerUpdate(data) {
        console.log("TabManager: Multiplayer update", data);
    }
}