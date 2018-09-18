# "telepathy"
![i think therefore i can][1]

# README #
Telepathic Elements are templated webcomponents with databinding designed to be so easy to use it's just like telepathy.

### Tiny but powerful! 
The entirety of Telepathic Elements is less than 5kb, RAW and < 1kb minified and compressed 

### Fast!
You can load the entire library in less than 10ms (including template rendering) even on a low end mobile device

### Standards Compliant!
Telepathy is completely standards compliant, we use webcomponents 1.x and that's it.  This means once you refactor your project to use telepathy, you won't have to refactor again in 6 months (or ever).  We aren't trying to break ground here, we just got tired of framework chasing.

### Use the JS, HTML & CSS you already know!
Telepathy has no external dependencies.  Everything is 100% vanilla JS and uses best practices throughout.

### 0 effort! gives you databinding, 1 Way and 2 Way
You can bind any attribute of any element automatically, just add a template literal that maps to some property inside your controller.
For example if you have an object "this" with a property "message", just add "${this.message} to the element in your template file.
For 2 way databinding, just add the same tag to the value property.
```
<!--One way Bind-->
I said ${this.message}<br>

<!-- Two way bind -->
<input value="${this.message}">
```

Now any time anyone uses that input element it will automatically update "I said"

Wait???  What about declaring binds, configuring shadow doms, setting observers and all the stuff everyone else uses???
Yeah, we do that too, but the framework figures those things out all on it's own, like magic.
Perhaps this is why we call the project... 
# "telepathy"
![initiating telepathic abilities][2]

## Usage ##

Download the telepathic-element.js webcomponent into your project then derive a new webcomponent using TelepathicElement as the base class

```
import {TelepathicElement} from "telepathic-elements/telepathic-element.js";
class MyTelepathicElement extends TelepathicElement{
	constructor(){
		super();
	}
	connectedCallback(){
		super.connectedCallback("my-telepathic-element.html");
		init();
	}
	init(){
		this.status = {
			message : `Hello from ${this.templateFileName}`
			statusClass : "ready"
		}
		setInterval(()=>{
			this.seconds++;
		},1000);
	}
}
window.customElements.define('my-telepathic-element', MyTelepathicElement);
```

Next create a template file with some HTML and misc tags

> my-telepathic-element.html ...
```
<style>
        /* contain CSS to the parent of this, speeds up calculations and helps with browsers that need to polyfill webcomponents 1x */
        :host {
                display: block;
                contain: content;
        }
        .ready{
                color: black;
                background-color: yellow;
                font-size: 3em;
        }
</style>
<div>
	<h1 class="${status.Class}">${status.message}<h1>
	<p>I've been telepathic for ${seconds}</p>
</div>
```

Now the custom element has been defined, you just need to use it somewhere and it's as easy as
>demo.html
```
<html>
    <script type="module" src="my-elements/my-telepathic-element.js"></script>
    <body>
        <my-telepathic-element></my-telepathic-element>
    </body>
</html>

```
Now serve up demo.html from any static hosting, or embedded in your own webapp and it just works
![mindblown][3]

[1]:http://www.pradeepaggarwal.com/ud_160/img_udemy.jpg
[2]:https://i.imgur.com/3dXl1Rp.jpg
[3]:https://media1.tenor.com/images/708cfcb92a5572a04996e0a9a0d05885/tenor.gif