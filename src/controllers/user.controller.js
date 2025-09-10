const _users = [{
    id: 1,
    name: 'John Doe',
    email: 'jd@gmail.comm'
}];
let _id = _users.length + 1;

const listUsers = (req, res) => {
    res.json({success: true, data: _users});
};

const createUser = (req, res) => {
    const {name, email} = req.body;
    if (!name || !email) {
        return res.status(400).json({success: false, message: 'Name and email are required'});
    }  
    
    const user = {id: _id++, name, email};
    _users.push(user);
    res.status(201).json({success: true, data: user});
}

const deleteUser = (req, res) => {
    const {id} = req.params;
    const index = _users.findIndex(u => u.id === parseInt(id));
    if (index === -1) {
        return res.status(404).json({success: false, message: 'User not found'});
    }
    
    _users.splice(index, 1);
    res.json({success: true, message:  `User with id ${id} deleted successfully`}); 
}

module.exports = {
    listUsers,
    createUser,
    deleteUser
};