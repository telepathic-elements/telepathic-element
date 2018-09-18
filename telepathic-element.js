export class TelepathicElement extends HTMLElement{
    constructor(){
        super();
        this.$ = this.attachShadow({mode: 'open'});
        this.templateRegex = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;
        String.prototype.replaceAll = function(search, replacement) {
            let target = this;
            return target.split(search).join(replacement);
        };
        this.uniq = (a) => Array.from(new Set(a));
    }

    async connectedCallback(templateFileName){
        //If no template file is supplied, then you need to repeat the following somewhere in your own code
        if(templateFileName){
           //These are the only two functions you need to call in your derived class
           await this.loadTemplate(templateFileName);
           await this.prepareTemplate();
        }      
    }

    async loadFile(fileName){
        return await(await(fetch(fileName))).text();
    }

    async loadTemplate(fileName){
        this.templateStr = await loadFile(fileName);
        console.log("template: ",this.templateStr);
    }

    async prepareTemplate(){
        this.templateBindings = {};
        this.templatePropertyNames = {};
        let templateStr = this.templateStr;
        let tags = await this.uniq(templateStr.match(this.templateRegex));
        this.template = document.createElement("template");
        this.template.innerHTML =  templateStr;
        this.$.appendChild(this.template.content.cloneNode(true));
        await this.compileTemplate(tags);
        window.testObject = this;
    }

    compileTemplate(tags){
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
                    if(!object.hasOwnProperty(prop)){
                        try{
                            object[prop] = {};
                        }catch(err){
                            console.warn(`Looks like you tried to bind a readonly property somewhere, if so disregard this ${err}`);
                        }
                        
                       
                    }
                    try{
                        this.templateBindings[props.join(".")] = new DataBind({object: object, property: prop});
                    }catch(err){
                        console.warn(`Looks like you tried to bind a readonly property somewhere, if so disregard this ${err}`);
                    }
                    object = object[prop];
                }
            }else{
                this.templateBindings[property] = new DataBind({object: this, property: property});
            }

            this.templatePropertyNames[tag] = property;
                                    
            let root = this.$;
            let iter = document.createNodeIterator(root, NodeFilter.SHOW_TEXT);
            let textnode;
            while (textnode = iter.nextNode()) {   
                let txt = textnode.textContent;
                if(txt.includes(tag)){
                    let newNode = document.createElement("span");
                    newNode.innerHTML = txt.replaceAll(tag,`<span data-bind='${tag}'></span>`);
                    let parentNode  = textnode.parentNode;
                    parentNode.replaceChild(newNode,textnode);
                }
            }
        };
       
        for(let tag of tags){
            let property = this.templatePropertyNames[tag];
            for(let node of this.$.querySelectorAll("*")){
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
                        this.templateBindings[property] = this.templateBindings[property].bindElement(node,"innerHTML"); 
                    }else{
                        node.setAttribute(attr.name,this[property]);            
                        this.templateBindings[property] = this.templateBindings[property].bindElement(node,attr.name,"change");
                    }
                }
            };
        }
    }
}

export class DataBind {
    constructor(source) {
        let _this = this;
        this.elementBindings = [];
        this.subscribeFuncs = [];
        this.value = source.object[source.property];
        this.valueGetter = function () {
            return _this.value;
        };
        this.valueSetter = function (val) {
            _this.value = val;
            for (let i = 0; i < _this.elementBindings.length; i++) {
                let binding = _this.elementBindings[i];
                try{
                   
                   if(binding.element[binding.attribute] !== val){
                        if(binding.attribute == "class"){
                            binding.element.className = val;
                        }else{
                            binding.element[binding.attribute] = val;
                        }
                   }
                }catch(error){
                    console.error(error);
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
            element[attribute] = _this.value;
            return _this;
        };
        Object.defineProperty(source.object, source.property, {
            get: this.valueGetter,
            set: this.valueSetter
        });
        source.object[source.property] = this.value;
    }
}
