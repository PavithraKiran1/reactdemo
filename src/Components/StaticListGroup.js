import { Fragment } from "react";
import Bootstrap from "bootstrap/js/src/tab.js";

function StaticListGroup() {
  return (<div>
    <ul className="nav nav-tabs" id="myTab" role="tablist">
      <li className="nav-item" role="presentation">
        <button className="nav-link active" id="home-tab" data-bs-toggle="tab" data-bs-target="#home" type="button" role="tab" aria-controls="home" aria-selected="true" style={{ backgroundColor: "whitesmoke" }}>Skills</button>
      </li>
      <li className="nav-item" role="presentation">
        <button className="nav-link" id="profile-tab" data-bs-toggle="tab" data-bs-target="#profile" type="button" role="tab" aria-controls="profile" aria-selected="false" style={{ backgroundColor: "whitesmoke" }}>Certification</button>
      </li>
      <li className="nav-item" role="presentation">
        <button className="nav-link" id="contact-tab" data-bs-toggle="tab" data-bs-target="#contact" type="button" role="tab" aria-controls="contact" aria-selected="false" style={{ backgroundColor: "whitesmoke" }}>Technical Articles</button>
      </li>
    </ul>
    <div className="tab-content" id="myTabContent">
      <div className="tab-pane fade show active" id="home" role="tabpanel" aria-labelledby="home-tab">C#, .NET
        SQL Server
        MVC3,MVC4 Entity Framework
        ASP.NET
        Web API 2.0
        .Net Core
        JQuery , Javascript
        Dapper Framework</div>
      <div className="tab-pane fade" id="profile" role="tabpanel" aria-labelledby="profile-tab">Microsoft Azure Certified AZ-900 (Certificate Number : I458-6776)
        · Agile scrum certification</div>
      <div className="tab-pane fade" id="contact" role="tabpanel" aria-labelledby="contact-tab">Article on Dependency Injection, Article on Decorator pattern</div>
    </div></div>);
}
export default StaticListGroup;