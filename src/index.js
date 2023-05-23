import React from 'react';
import ReactDOM from 'react-dom/client';
import Myprofile from './myProfile';
import MyPhoto from './staticImages/pavi.jpg';
import CommonCSS from './CommonCss.css'
import BasicFundamentals from './Components/BasicFundamentals'

// import Uicomponent from './uicomponent';
// import ProfileCard from './profilecard';
// import Destructuring from './destructuring';

const rootelement = document.getElementById('root');
const reactelement=ReactDOM.createRoot(rootelement);

function App()
{
    const message='Hello';
    return (<div className='login-component'><Myprofile image={MyPhoto}/> </div>)
    //return (<div><h1>{message}</h1><Uicomponent/><div>Personal details</div><div><ProfileCard title="test"/></div><div><Destructuring title="name" handle="age" /></div></div>);
}

reactelement.render(<App/>)