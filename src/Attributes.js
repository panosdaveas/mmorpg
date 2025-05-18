// attributes/Attribute.js
export class Attribute {
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }

    set(value) {
        this.value = value;
    }

    get() {
        return this.value;
    }

    toJSON() {
        return {
            name: this.name,
            value: this.value
        };
    }

    static fromJSON(data) {
        return new Attribute(data.name, data.value);
    }
  }