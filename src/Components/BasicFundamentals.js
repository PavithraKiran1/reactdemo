import { useState } from "react";
import DescriptionArticle from "./DescriptionArticle";

function BasicFundamentals() {
    const message = "Articles Published ...";
    const articles = ['Design Pattern', 'Dependency Injection', 'Scaffolding','React'];
    //Managing state
    // const selectedIndex= 0;
    //Hook
    const [selectedIndex,setSelectedIndex] =useState();
    //Event handler
    const handleClick=(event)=>(console.log(event));

    //Conditional Rendering (can be declared as const message, as function or using in jsx within {})
    const GetArticles=()=>
    {
        return <><ul className="list-group">{articles.length ===0? null:articles.map((eacharticle,index)=> <li key={eacharticle} onClick={()=>{setSelectedIndex(index);}} className={selectedIndex===index ?'list-group-item active':'list-group-item'}>{eacharticle}</li>)}</ul></>;
       // return <>{articles.length ===0? null:articles.map(eacharticle=> <h5 key={eacharticle} onClick={()=> console.log("test")}>{eacharticle}</h5>)}</>;
    }
 
    //For Loop Implementation
    return (<><div className="container"><div className="row">  <div className="col align-self-start"><h3 style={{color:"#e3f2fd"}}>{message}</h3></div>{GetArticles()}</div> <div className="col align-self-center"><DescriptionArticle index={selectedIndex}/></div></div></>);
}

export default BasicFundamentals;