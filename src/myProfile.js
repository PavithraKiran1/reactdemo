import ListGroup from './Components/BlogListGroup';
import bootstrap from 'bootstrap/dist/css/bootstrap.css';
import StaticListGroup from './Components/StaticListGroup';
import BasicFundamentals from './Components/BasicFundamentals'

function Myprofile(props)
{
const {image}=props;
 return(<div className="container">
 <div className="row">
   <div className="col">

    <img src={image} className="img-circle" />
 
    </div>
    <div className="col">
    <ListGroup/>
    </div>
   
  </div>
  <div>
    <br/>
  </div>
  <div className="row">
   <StaticListGroup/>
   
  </div>
  <div className="container" style={{height:"100%"}}><br/><BasicFundamentals/></div>
</div>);
}

export default Myprofile;