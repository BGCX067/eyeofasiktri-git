var databaseUrl = "mydb";
var dbCollections = ["bot", "messageBuffer", "Game", "entities", "portals"];
var db = require("mongojs").connect(databaseUrl, dbCollections);
var irc = require("./irc");
var extend = require("xtend");
var sys = require("sys");
var commands = require("./commands.js");
var sleep = require("sleep");
var playermanager = require("./playermanager.js");


exports.createClasses = createClasses;
exports.getClassByName = getClassByName;
exports.getSkillModifier = getSkillModifier;

var classes = [];
var skills = [];

function createClasses() {
	classes.push(extend(Class, {
		name: "thrall",
		modifiers: []
	}));

	classes.push(extend(Class, {
		name: "cognate",
		modifiers: []
	}));

	classes.push(extend(Class, {
		// hypnotist
		// mesmer
		// mystic
		// messiah
		// idol
		// pusher
		name: "idol",
		modifiers: []
	}));

}

function getClassByName(name) {
	for (var i = 0; i < classes.length; i++) {
		if (name.toLowerCase() == classes[i].name) return classes[i];
	}
	return null;
}

function getSkillModifier(skill, classname) {
	if (skill.type != "skill") return extend(SkillModifier);
	if (!skill.hasOwnProperty("modifiers")) return extend(SkillModifier);
	for (var i = 0; i < skill.modifiers.length; i++) {
		if (classname == skill.modifiers[i].classname) 
			return skill.modifiers[i];
	}
	return extend(SkillModifier);
}

function createSkills() {
	skills.push(extend(Skill, {
		name: "listen",
		modifiers: [
			extend(SkillModifier,{
				classname: 	"thrall",
				practiceMod: 	1.1,
				bonus:		.1,
				max:		1
			}),
			extend(SkillModifier,{
				classname:	"cognate",
				practiceMod:	1.0,
				bonus:		0,
				max:		1
			}),
			extend(SkillModifier, {
				classname:	"idol",
				practiceMod:	.7,
				bonus:		-.1
				max:		0.8
			})
		]

	}));

	skills.push(extend(Skill, {
		name: "compel",
		modifiers: [
			extend(SkillModifier,{
				classname: 	"thrall",
				practiceMod: 	1.1,
				bonus:		-.12,
				max:		1
			}),
			extend(SkillModifier,{
				classname:	"cognate",
				practiceMod:	1.0,
				bonus:		0,
				max:		1
			}),
			extend(SkillModifier, {
				classname:	"idol",
				practiceMod:	1.0,
				bonus:		.1
				max:		1
			})
		]

	}));

	skills.push(extend(Skill, {
		name: "relax",
		modifiers: [
			extend(SkillModifier,{
				classname: 	"thrall",
				practiceMod: 	1.1,
				bonus:		.1,
				max:		1
			}),
			extend(SkillModifier,{
				classname:	"cognate",
				practiceMod:	1.0,
				bonus:		0,
				max:		1
			}),
			extend(SkillModifier, {
				classname:	"idol",
				practiceMod:	.7,
				bonus:		-.1
				max:		0.8
			})
		]
	}));

	skills.push(extend(Skill, {
		name: "fixation techniques",
		modifiers: [
			extend(SkillModifier,{
				classname: 	"thrall",
				practiceMod: 	.8,
				bonus:		0,
				max:		.8
			}),
			extend(SkillModifier,{
				classname:	"cognate",
				practiceMod:	1.0,
				bonus:		0,
				max:		1
			}),
			extend(SkillModifier, {
				classname:	"idol",
				practiceMod:	1,
				bonus:		0
				max:		1
			})
		]
	}));

	skills.push(extend(Skill, {
		name: "fixate",
		modifiers: [
			extend(SkillModifier,{
				classname: 	"thrall",
				practiceMod: 	1.1,
				bonus:		.1,
				max:		1
			}),
			extend(SkillModifier,{
				classname:	"cognate",
				practiceMod:	1.0,
				bonus:		0,
				max:		1
			}),
			extend(SkillModifier, {
				classname:	"idol",
				practiceMod:	.7,
				bonus:		-.1
				max:		0.8
			})
		]
	}));
}

function getClasses() {
	return classes;
}

function getFluencyLabel(proficiency) {
	if (proficiency == 0) {
		return "ignorant";
	} else if (proficiency < .10) {
		return "casual";
	} else if (proficiency < .20) {
		return "novice";
	} else if (proficiency < .30) {
		return "student";
	} else if (proficiency < .40) {
		return "sophmore";
	} else if (proficiency < .50) {
		return "comfortable";
	} else if (proficiency < .60) {
		return "fluent";
	} else if (proficiency < .70)
		return "focused";
	} else if (proficiency < .80) {
		return "self-critical";
	} else if (proficiency < .90) {
		return "all-encompasing";
	} else if (proficiency < .95) {
		return "mastery";
	} else {
		return "enlightened";
	}
}

var Skill = {
	type: "skill",
	name: "undefined"

}

var SkillModifier = {
	classname: "undefined",
	practiceMod: 1,
	bonus: 0,
	max: 1
}

var Class = {
	type: "class",
	name: "undefined",
	modifiers: []
}
