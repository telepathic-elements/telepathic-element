import {Marked} from '../marked/lib/marked-class.mjs';

export class TelepathicElement extends HTMLElement{
    static describe(){return `TelepathicElement provides the base class for all telepathic-elements.  It is responsible for all templating and binding operations.`};

    constructor(fileName,noshadow,delayRender){
        super();
        this.initialized = false;
        
        this.promises = []; //Helps speed up loading to defer things to init in derived constructors
        if(noshadow){
            this.$ = this;
        }else{
            try{
                this.$ = this.attachShadow({mode: 'open'});
            }catch(err){
                //Firefox and some others don't support shadow dom completely or at all.
                console.warn(err);
                this.$ = this;
            }
        }
        if(!this.$){
            this.$ = this;
        }
        this.delayRender = delayRender;
        this.templateBindings = {};
        this.templatePropertyNames = {};
        if(fileName){
            this.templateFileName = fileName;
        }
    }

    async connectedCallback(){
        if(!this.initialized){
            this.className = this.constructor.name;
            await Promise.all(this.promises)
            .then(async ()=>{
                await this.prepareTemplate();
                if(this['init']){
                    await this.init();
                }
                if(!this.delayRender){
                    await this.render();
                    if(this.onReady){
                        this.onReady();
                    }
                }
            });
        }else{
            await this.render();
        }
    }
    
    async loadFile(fileName){
        console.log("Loading: ",fileName);
        let response = await fetch(fileName);
        if(response.ok){
            return await response.text();
        }else{
            throw(`${response.status} : ${response.statusText}`);
        }
    }

    async loadFileJSON(fileName){
        return await(await(fetch(fileName))).json();
    }

    async loadTemplate(fileName){
        let file;
        let marked = new Marked();
        if(fileName){
            if(!window[fileName]){
                file = await this.loadFile(fileName);
                this.templateStr = marked.parse(file);
                window[fileName] = this.templateStr;
            }else{
                this.templateStr = window[fileName];
            }
            this.templateFileName = fileName;
        }else{
            let path = window[this.className];
            let tagName = this.tagName.toLowerCase();
            let mdFile= `${path}/${tagName}/${tagName}.md`;
            try{
                file = await this.loadFile(mdFile);
                try{
                    this.templateStr = await marked.parse(file);
                    this.templateFileName = mdFile;
                }catch(err){
                    console.error(err);
                }
            }catch(err){
                //We're still going to try and parse any markdown we find in the template whether it's  .md or .html
                let htmlFile = `${path}/${tagName}/${tagName}.html`;
                file = await this.loadFile(htmlFile);
                this.templateStr = file;
                this.templateFileName = htmlFile;
            }
            
        }
        console.log("this.templateFileName: ",this.templateFileName);
        //console.log("file: ",file);
        //console.log("this.templateStr: ",this.templateStr);
    }

    async prepareTemplate(fileName){
        if(!this.templateStr){
            if(fileName){
                console.warn("Template not yet loaded for ",fileName);
            }
            await this.loadTemplate(fileName);
            console.log("Loaded ",this.templateFileName);
        }
        //console.log(`Preparing ${this.templateFileName}`);
        let templateStr = this.templateStr;
        this.template = document.createElement("template");
        this.template.innerHTML =  templateStr;
        this.$.appendChild(this.template.content.cloneNode(true));
        //Need loader to inject here and load submodules that were hidden previously
        window.TelepathicLoader.Load(this.$);
    }

    async render(){
        if(this.templateStr){
            let tags = await uniq(this.templateStr.match(TelepathicElement.templateRegex));
            await this.compileTemplate(tags);
        }
        console.log(`${this.templateFileName} is rendered`);
    }

    compileTemplate(tags){
        console.log("tags: ",tags);
        this.propertyNames = {};
        for(let tag of tags){
            let property = tag.replaceAll("${","").replaceAll("}","").replaceAll("this.","");
        
            let object = this;
            if(property.includes(".")){
                let properties  = property.split(".");
                let props = [];
                for(let i = 0; i <= properties.length -1; i++){
                    let prop = properties[i];
                    props.push(prop);
                    if(object[prop] === undefined){
                        console.warn("Found undeclared property ",props.join('.')," in template ",this);
                        object[prop] = 'undeclared';
                    }
                    try{
                        this.templateBindings[props.join(".")] = new DataBind({object: object, property: prop});
                    }catch(err){
                        console.warn(`Looks like you tried to bind a readonly property somewhere, if so disregard this ${err}`);
                    }
                    object = object[prop];
                }
            }else{
                try{
                    console.log("About to bind "+property+": ",this[property]," to ",this.templateBindings);
                    if(this[property]=== undefined){
                        console.warn(property+" was undefined");
                        this[property] = "undefined"; 
                    }
                    this.templateBindings[property] = new DataBind({object: this, property: property});
                }catch(err){
                    console.warn(`Looks like you tried to bind a readonly property somewhere, if so disregard this ${err}`);
                }
            }

            this.templatePropertyNames[tag] = property;
                                    
            let root = this.$;
            let iter = document.createNodeIterator(root, NodeFilter.SHOW_TEXT);
            let textnode;
            while (textnode = iter.nextNode()) {   
                let txt = textnode.textContent;
                if(txt.includes(tag)){
                    let newNode = document.createElement("span");
                    //console.log(`Replacing ${tag} with <span data-bind='${tag}'></span>`);
                    if(typeof tag !== HTMLElement){
                        newNode.innerHTML = txt.replaceAll(tag,`<span data-bind='${tag}'></span>`);
                    }else{
                        newNode.appendChild(tag);
                    }
                    //console.log("After replacement: ",newNode.innerHTML);
                    let parentNode  = textnode.parentNode;
                    parentNode.replaceChild(newNode,textnode);
                    //console.log("Parent is now: ",parentNode);
                }
            }
        };
       
        for(let tag of tags){
            let property = this.templatePropertyNames[tag];
            for(let node of this.$.querySelectorAll("*")){
                //console.log("compiling: "+tag+" : "+property+" against ",node);
                this.compileNodeAttributes(node, tag, property);
            }
        }
    }
  
    compileNodeAttributes(node,tag,property){
        if(node.hasAttributes()){
            let attrs = node.attributes;
            for(var i = attrs.length - 1; i >= 0; i--) {
                let attr = attrs[i];
                if(attr.value == tag){
                    if(attr.name == "data-bind"){
                        node.removeAttribute("data-bind");
                        if(this.templateBindings[property]){
                            //console.log("removing data-bind =",tag," on ",node," setting bind to innerHTML property is ",property);
                            this.templateBindings[property] = this.templateBindings[property].bindElement(node,"innerHTML"); 
                        }else{
                            throw("Couldn't find "+property+" on ",this.templateBindings);
                        }
                    }else{
                       
                        if(this[property] == tag && node.getAttribute(attr.name) == tag){
                            if(attr.name != "value"){
                                //console.log("Clearing "+attr.name+" on ",node);
                                node.setAttribute(attr.name,"");
                            }else{
                                //console.log("Clearing value for "+attr.name+" on ",node);
                                node.value ="";
                            }
                        }else{
                            //console.log("Setting "+attr.name+" to ",this[property]+" on ",node);
                            node.setAttribute(attr.name,this[property]);
                        }
                        if(this.templateBindings[property]){            
                            this.templateBindings[property] = this.templateBindings[property].bindElement(node,attr.name,"change");
                        }else{
                            throw("Couldn't find "+property+" on ",this.templateBindings);
                        }
                    }
                }
            };
        }
    }
}
TelepathicElement.templateRegex = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;
export class DataBind {
    constructor(source) {
        let _this = this;
        
        this.elementBindings = [];
        this.subscribeFuncs = [];
        this.value = source.object[source.property];
        this.valueGetter = function () {
            //console.log("DataBind.valueGetter: ",_this);
            if(typeof _this === HTMLElement){
                return _this;
            }else{
                return _this.value;
            }
        };
        this.valueSetter = function (val) {
            let oldval = _this.value; 
            _this.value = val;
            for (let i = 0; i < _this.elementBindings.length; i++) {
                let binding = _this.elementBindings[i];
                try{
                   //console.log(binding.element," @ ",binding.attribute," was ",oldval," now ",val," type is ",(typeof val));
                   
                   if(binding.element[binding.attribute] !== val){
                        if(binding.attribute == "class"){
                            if(binding.element.classList.contains(oldval)){
                                binding.element.classList.remove(oldval);
                                binding.element.classList.add(val);
                            }
                        }else{
                            if(binding.attribute){
                                if(binding.attribute == "innerHTML"){// && val instanceof HTMLElement){
                                    ////console.log(binding.element," @ ",binding.attribute," = val.innerHTML: ",val.innerHTML.toString());
                                    if(val instanceof HTMLElement){
                                        let oldNode = binding.element.firstChild;
                                        binding.element.replaceChild(val,oldNode);
                                    }else{
                                        binding.element.innerHTML = val;
                                    }
                                    //binding.element.innerHTML = val.innerHTML;
                                    ////console.log("afterwards - binding.element[binding.attribute] : ",binding.element[binding.attribute]);
                                }else{
                                    
                                    if(binding.attribute !== "value"){
                                        //console.log(binding.element," @ ",binding.attribute," = ",val);
                                        binding.element.setAttribute(binding.attribute,val);
                                    }else{
                                        //console.log(binding.element," = ",val);
                                        binding.element.value = val;
                                    }
                                }
                            }else{
                                throw("Trying to update value on empty attribute for ",binding.element," with ",_this);

                            }
                        }
                   }
                }catch(error){
                    //console.error(error);
                }
            }
        };
        this.bindElement = function (element, attribute, event) {
            let binding = {
                element: element,
                attribute: attribute
            };
            if (event) {
                element.addEventListener(event, function (event) {
                    _this.valueSetter(element[attribute]);
                });
                binding.event = event;
            }
            this.elementBindings.push(binding);
            if(_this instanceof HTMLElement){
                //console.error("_this is HTMLElement ",_this);                
            }
            if(element instanceof HTMLElement && _this.value instanceof HTMLElement){
                //console.error(" element is HTMLElement ",element);
                //console.error("_this.value is ",_this.value);
                let oldNode = element.firstChild;
                //console.log("oldNode: ",oldNode);
                if(oldNode){
                    element.replaceChild(_this.value,oldNode);
                }else{
                    element.appendChild(_this.value);
                }
                
            }else{
                element[attribute] = _this.value;
            }
            if(!event){
                event = "*"
            }
            //console.log("Binding ",element," @ ",attribute," : ",event," to ",this);
            return _this;
        };
        Object.defineProperty(source.object, source.property, {
            get: this.valueGetter,
            set: this.valueSetter
        });
        source.object[source.property] = this.value;
    }
}
//Adding this here because there's no other good place to put it
String.prototype.replaceAll = function(search, replacement) {
    let target = this;
    return target.split(search).join(replacement);
};
const uniq = (a) => Array.from(new Set(a));
