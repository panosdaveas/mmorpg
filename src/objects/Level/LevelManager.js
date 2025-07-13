import { Vector2 } from "../../Vector2.js";
import { gridCells } from "../../helpers/grid.js";
import { events } from "../../Events.js";

// Import level classes
import { MainMap } from "../../levels/map.js";
import { Room1 } from "../../levels/room1.js";
import { Room2 } from "../../levels/room2.js";

export class LevelManager {
    constructor() {
        this.config = null;
        this.levelClasses = {
            'MainMap': MainMap,
            'Room1': Room1,
            'Room2': Room2,
            // Add more level class mappings
            // 'Cave1': Cave1,
        };
    }

    async loadConfig() {
        try {
            const response = await fetch('./src/levels/levels-config.json');
            this.config = await response.json();
            console.log('Level configuration loaded:', this.config);
        } catch (error) {
            console.error('Failed to load level configuration:', error);
            throw error;
        }
    }

    getLevelConfig(levelId) {
        if (!this.config) {
            throw new Error('Level configuration not loaded');
        }
        return this.config.levels[levelId];
    }

    getExitConfig(levelId, exitId) {
        const levelConfig = this.getLevelConfig(levelId);
        if (!levelConfig || !levelConfig.exits) {
            return null;
        }
        return levelConfig.exits.find(exit => exit.id === exitId);
    }

    getSpawnPosition(levelId, spawnPointId = 'default') {
        const levelConfig = this.getLevelConfig(levelId);
        if (!levelConfig || !levelConfig.spawnPoints) {
            throw new Error(`No spawn points found for level: ${levelId}`);
        }

        const spawnPoint = levelConfig.spawnPoints[spawnPointId] || levelConfig.spawnPoints.default;
        if (!spawnPoint) {
            throw new Error(`Spawn point '${spawnPointId}' not found in level '${levelId}'`);
        }

        return new Vector2(gridCells(spawnPoint[0]), gridCells(spawnPoint[1]));
    }

    createLevel(levelId, spawnPointId = 'default', params = {}) {
        const levelConfig = this.getLevelConfig(levelId);
        if (!levelConfig) {
            throw new Error(`Level configuration not found: ${levelId}`);
        }

        const LevelClass = this.levelClasses[levelConfig.className];
        if (!LevelClass) {
            throw new Error(`Level class not found: ${levelConfig.className}`);
        }

        const heroPosition = this.getSpawnPosition(levelId, spawnPointId);

        console.log(`Creating level: ${levelId}, spawn: ${spawnPointId}, position:`, heroPosition);

        const newLevel = new LevelClass({
            heroPosition,
            levelId,
            ...params
        });

        // Pass the full configuration to the level so it can create exits
        newLevel.setLevelConfig(this.config);

        return newLevel;
    }

    handleLevelTransition(currentLevelId, exitData, transitionParams = {}) {
        const exitConfig = this.getExitConfig(currentLevelId, exitData.exitId);

        if (!exitConfig) {
            console.warn(`Exit configuration not found: ${exitData.exitId} in level ${currentLevelId}`);
            return null;
        }

        console.log(`Transitioning from ${currentLevelId} via ${exitData.exitId} to ${exitConfig.targetLevel}`);

        return this.createLevel(
            exitConfig.targetLevel,
            exitConfig.targetSpawnPoint,
            transitionParams
        );
    }
}