function DescriptionArticle(props)
{
const {index}=props;
const description=['A design pattern is the re-usable form of a solution to a design problem. The idea was introduced by the architect Christopher Alexander[1] and has been adapted for various other disciplines, particularly software engineering.','NET supports the dependency injection (DI) software design pattern, which is a technique for achieving Inversion of Control (IoC) between classes and their dependencies.','Scaffolding, also called scaffold or staging,[2] is a temporary structure used to support a work crew and materials to aid in the construction, maintenance and repair of buildings, bridges and all other man-made structures. ','React is a JavaScript library for building user interfaces.'];
return (<>{description[index]}</>);
}

export default DescriptionArticle;